-- =====================================================================
-- kerchi — Supabase schema
-- 在 Supabase Studio → SQL Editor 貼上整份 → RUN。
-- 安全重點：題目的正確答案/解析「不會」直接傳到學生瀏覽器。
--   - 學生作答透過 get_exam_questions()（去掉答案）
--   - 評分在伺服器端的 submit_attempt()（SECURITY DEFINER）完成
--   - 交卷後檢討透過 get_attempt_review()（限本人/管理員）
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- profiles（1:1 對應 auth.users）
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'student' check (role in ('student','provider','admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles for select using (true);

drop policy if exists "profiles self upsert" on public.profiles;
create policy "profiles self upsert" on public.profiles
  for insert with check (auth.uid() = id);

-- 使用者可改自己的 display_name，但「不能」把自己升級成 admin/provider。
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- 是否為管理員 / 出題者（給 RLS 用的小工具）
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function public.is_provider()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('provider','admin'));
$$;

-- 新使用者自動建立 profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 自助刪除帳號
create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  uid := auth.uid();
  if uid is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;

-- ---------------------------------------------------------------------
-- exams（考卷 / 題庫單位）
-- ---------------------------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  stage text not null check (stage in
    ('kindergarten','elementary','junior_high','senior_high','university','society')),
  grade text,
  semester int check (semester in (1,2)),
  subject text not null,
  description text,
  source_images text[] not null default '{}',
  proctor_password text,        -- null → 用全站預設監考密碼
  time_limit_minutes int,       -- null → 不限時
  is_published boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists exams_published_idx on public.exams (is_published, created_at desc);
create index if not exists exams_filter_idx on public.exams (stage, subject);

alter table public.exams enable row level security;

drop policy if exists "exams read" on public.exams;
create policy "exams read" on public.exams
  for select using (is_published or created_by = auth.uid() or public.is_admin());

drop policy if exists "exams provider insert" on public.exams;
create policy "exams provider insert" on public.exams
  for insert with check (public.is_provider() and created_by = auth.uid());

drop policy if exists "exams owner update" on public.exams;
create policy "exams owner update" on public.exams
  for update using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists "exams owner delete" on public.exams;
create policy "exams owner delete" on public.exams
  for delete using (created_by = auth.uid() or public.is_admin());

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists exams_touch on public.exams;
create trigger exams_touch before update on public.exams
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- questions（題目；含答案/解析，僅 owner/admin 可直接讀）
-- ---------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  order_index int not null default 0,
  type text not null check (type in
    ('single_choice','multiple_choice','true_false','fill_blank','fill_text')),
  stem text not null,
  passage text,                                  -- 閱讀測驗短文（同一篇的子題共用）
  image_url text,
  options jsonb not null default '[]'::jsonb,   -- [{key,text}, ...]
  answer jsonb not null default '[]'::jsonb,     -- ["A"] / ["A","C"] / ["true"]
  explanation text,
  chapter text,
  skill_tags text[] not null default '{}',
  points int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists questions_exam_idx on public.questions (exam_id, order_index);

alter table public.questions enable row level security;

-- 只有 owner / admin 能直接讀題（含答案）。學生改用 get_exam_questions()。
drop policy if exists "questions owner read" on public.questions;
create policy "questions owner read" on public.questions
  for select using (
    public.is_admin()
    or exists (select 1 from public.exams e where e.id = exam_id and e.created_by = auth.uid())
  );

drop policy if exists "questions owner write" on public.questions;
create policy "questions owner write" on public.questions
  for all using (
    public.is_admin()
    or exists (select 1 from public.exams e where e.id = exam_id and e.created_by = auth.uid())
  ) with check (
    public.is_admin()
    or exists (select 1 from public.exams e where e.id = exam_id and e.created_by = auth.uid())
  );

-- ---------------------------------------------------------------------
-- attempts（作答紀錄）+ attempt_answers（逐題）
-- ---------------------------------------------------------------------
create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_seconds int,
  earned_points int,
  total_points int,
  correct_count int,
  question_count int,
  score numeric(5,2),               -- 百分比 0–100
  status text not null default 'in_progress' check (status in ('in_progress','submitted','abandoned')),
  per_chapter jsonb,                 -- {"第一章":{"correct":3,"total":4}, ...}
  violations_count int not null default 0,
  violation_log jsonb not null default '[]'::jsonb
);

create index if not exists attempts_user_idx on public.attempts (user_id, submitted_at desc);
create index if not exists attempts_exam_idx on public.attempts (exam_id);
create index if not exists attempts_records_idx on public.attempts (status, submitted_at desc);

alter table public.attempts enable row level security;

-- 已交卷的紀錄大家都能看（瀏覽「之前使用者的答題記錄」）；未交卷的只有本人/admin。
drop policy if exists "attempts read" on public.attempts;
create policy "attempts read" on public.attempts
  for select using (status = 'submitted' or user_id = auth.uid() or public.is_admin());

drop policy if exists "attempts self insert" on public.attempts;
create policy "attempts self insert" on public.attempts
  for insert with check (user_id = auth.uid());

drop policy if exists "attempts self update" on public.attempts;
create policy "attempts self update" on public.attempts
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  user_answer jsonb not null default '[]'::jsonb,
  is_correct boolean not null default false,
  time_spent_seconds int not null default 0,
  unique (attempt_id, question_id)
);

create index if not exists attempt_answers_idx on public.attempt_answers (attempt_id);

alter table public.attempt_answers enable row level security;

-- 逐題明細（含對錯）只有本人/admin 能讀；寫入只透過 submit_attempt()。
drop policy if exists "answers owner read" on public.attempt_answers;
create policy "answers owner read" on public.attempt_answers
  for select using (
    public.is_admin()
    or exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid())
  );

-- =====================================================================
-- RPCs
-- =====================================================================

-- 取得「給學生作答用」的題目（不含答案/解析）
create or replace function public.get_exam_questions(p_exam_id uuid)
returns table (
  id uuid, order_index int, type text, stem text, passage text,
  image_url text, options jsonb, chapter text, points int
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.exams e
    where e.id = p_exam_id and (e.is_published or e.created_by = auth.uid() or public.is_admin())
  ) then
    raise exception 'exam not found or not accessible';
  end if;

  return query
    select q.id, q.order_index, q.type, q.stem, q.passage, q.image_url, q.options, q.chapter, q.points
    from public.questions q
    where q.exam_id = p_exam_id
    order by q.order_index, q.created_at;
end;
$$;
grant execute on function public.get_exam_questions(uuid) to anon, authenticated;

-- jsonb 字串陣列 → 排序後的 text[]（用於比對答案集合）
create or replace function public.sorted_str_arr(j jsonb)
returns text[] language sql immutable as $$
  select coalesce(array(select jsonb_array_elements_text(j) order by 1), '{}');
$$;

-- 文字正規化（填空題比對用）：去空白、全形→半形、轉小寫
create or replace function public.norm_text(s text)
returns text language sql immutable as $$
  select lower(
    translate(
      regexp_replace(coalesce(s, ''), '[[:space:]　]', '', 'g'),
      '０１２３４５６７８９％．（）ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ',
      '0123456789%.()ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    )
  );
$$;

-- 交卷 + 伺服器端評分
create or replace function public.submit_attempt(
  p_attempt_id uuid,
  p_answers jsonb,            -- {"<question_id>": ["A"], ...}
  p_times jsonb,             -- {"<question_id>": 12, ...}
  p_duration_seconds int,
  p_violations int default 0,
  p_violation_log jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_attempt public.attempts%rowtype;
  q record;
  ua text[];
  ca text[];
  v_ua_text text;
  v_correct boolean;
  v_earned int := 0;
  v_total int := 0;
  v_correct_count int := 0;
  v_count int := 0;
  v_score numeric(5,2);
  v_per_chapter jsonb;
begin
  select * into v_attempt from public.attempts where id = p_attempt_id;
  if not found then raise exception 'attempt not found'; end if;
  if v_attempt.user_id <> auth.uid() then raise exception 'not your attempt'; end if;
  if v_attempt.status = 'submitted' then raise exception 'already submitted'; end if;

  for q in
    select * from public.questions where exam_id = v_attempt.exam_id
  loop
    if q.type = 'fill_text' then
      -- 直接書寫：正規化後比對是否命中任一可接受答案
      v_ua_text := public.norm_text(coalesce((p_answers -> q.id::text) ->> 0, ''));
      v_correct := v_ua_text <> '' and exists (
        select 1 from jsonb_array_elements_text(q.answer) aa
        where public.norm_text(aa) = v_ua_text
      );
    else
      -- 選擇/是非/同音字：選項 key 的集合相等
      ua := public.sorted_str_arr(coalesce(p_answers -> q.id::text, '[]'::jsonb));
      ca := public.sorted_str_arr(q.answer);
      v_correct := array_length(ca, 1) is not null and ua = ca;
    end if;

    v_count := v_count + 1;
    v_total := v_total + q.points;
    if v_correct then
      v_earned := v_earned + q.points;
      v_correct_count := v_correct_count + 1;
    end if;

    insert into public.attempt_answers (attempt_id, question_id, user_answer, is_correct, time_spent_seconds)
    values (
      p_attempt_id, q.id,
      coalesce(p_answers -> q.id::text, '[]'::jsonb),
      v_correct,
      coalesce((p_times ->> q.id::text)::int, 0)
    )
    on conflict (attempt_id, question_id) do update
      set user_answer = excluded.user_answer,
          is_correct = excluded.is_correct,
          time_spent_seconds = excluded.time_spent_seconds;
  end loop;

  v_score := case when v_total > 0 then round(v_earned * 100.0 / v_total, 2) else 0 end;

  select coalesce(jsonb_object_agg(s.chap, jsonb_build_object('correct', s.c, 'total', s.t)), '{}'::jsonb)
  into v_per_chapter
  from (
    select coalesce(q.chapter, '未分類') as chap,
           count(*) as t,
           count(*) filter (where aa.is_correct) as c
    from public.attempt_answers aa
    join public.questions q on q.id = aa.question_id
    where aa.attempt_id = p_attempt_id
    group by 1
  ) s;

  update public.attempts set
    submitted_at = now(),
    duration_seconds = greatest(coalesce(p_duration_seconds, 0), 0),
    earned_points = v_earned,
    total_points = v_total,
    correct_count = v_correct_count,
    question_count = v_count,
    score = v_score,
    status = 'submitted',
    per_chapter = v_per_chapter,
    violations_count = coalesce(p_violations, 0),
    violation_log = coalesce(p_violation_log, '[]'::jsonb)
  where id = p_attempt_id;

  return jsonb_build_object(
    'attempt_id', p_attempt_id,
    'score', v_score,
    'earned_points', v_earned,
    'total_points', v_total,
    'correct_count', v_correct_count,
    'question_count', v_count,
    'per_chapter', v_per_chapter
  );
end;
$$;
grant execute on function public.submit_attempt(uuid, jsonb, jsonb, int, int, jsonb) to authenticated;

-- 交卷後逐題檢討（限本人 / admin）
create or replace function public.get_attempt_review(p_attempt_id uuid)
returns table (
  question_id uuid, order_index int, type text, stem text, passage text, options jsonb,
  chapter text, points int, explanation text,
  correct_answer jsonb, user_answer jsonb, is_correct boolean, time_spent_seconds int
)
language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.attempts where id = p_attempt_id;
  if v_owner is null then raise exception 'attempt not found'; end if;
  if v_owner <> auth.uid() and not public.is_admin() then
    raise exception 'not allowed';
  end if;

  return query
    select q.id, q.order_index, q.type, q.stem, q.passage, q.options, q.chapter, q.points, q.explanation,
           q.answer, aa.user_answer, aa.is_correct, aa.time_spent_seconds
    from public.attempt_answers aa
    join public.questions q on q.id = aa.question_id
    where aa.attempt_id = p_attempt_id
    order by q.order_index, q.created_at;
end;
$$;
grant execute on function public.get_attempt_review(uuid) to authenticated;

-- 驗證監考密碼（密碼不外流到瀏覽器）。null → 預設 '0000'。
create or replace function public.check_proctor_password(p_exam_id uuid, p_password text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select coalesce(e.proctor_password, '0000') = p_password from public.exams e where e.id = p_exam_id),
    false
  );
$$;
grant execute on function public.check_proctor_password(uuid, text) to authenticated;

-- 題庫統計（每張考卷幾題）給列表用
-- security_invoker：依「呼叫者」的 RLS 過濾（只看得到已發布或自己的考卷）；
-- 且「不」輸出 proctor_password —— 監考密碼絕不外流到瀏覽器。
drop view if exists public.exams_with_counts;
create view public.exams_with_counts
  with (security_invoker = on) as
  select e.id, e.title, e.stage, e.grade, e.semester, e.subject, e.description,
         e.source_images, e.time_limit_minutes, e.is_published, e.created_by,
         e.created_at, e.updated_at,
         (select count(*) from public.questions q where q.exam_id = e.id) as question_count
  from public.exams e;
grant select on public.exams_with_counts to anon, authenticated;

-- ---------------------------------------------------------------------
-- storage：exam-uploads（考卷翻拍 / 題目圖；公開可讀，出題者可寫）
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('exam-uploads', 'exam-uploads', true, 15 * 1024 * 1024,
        array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "exam uploads public read" on storage.objects;
create policy "exam uploads public read" on storage.objects
  for select using (bucket_id = 'exam-uploads');

drop policy if exists "exam uploads provider write" on storage.objects;
create policy "exam uploads provider write" on storage.objects
  for insert with check (
    bucket_id = 'exam-uploads' and public.is_provider()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "exam uploads owner delete" on storage.objects;
create policy "exam uploads owner delete" on storage.objects
  for delete using (
    bucket_id = 'exam-uploads'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
