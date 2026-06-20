import Link from "next/link";
import { ArrowRight, FileText, History, Sparkles, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ExamCard } from "@/components/exam/exam-card";
import { Button } from "@/components/ui/button";
import { examMeta, gradeText, TONE_TEXT } from "@/lib/exam";
import { pct } from "@/lib/utils";
import type { Attempt, Exam } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getData() {
  try {
    const supabase = await createClient();
    const [examsRes, attemptsRes] = await Promise.all([
      supabase
        .from("exams_with_counts")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("attempts")
        .select("*, exams(title,subject,stage,semester,grade), profiles(display_name)")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .limit(5),
    ]);
    return {
      exams: (examsRes.data ?? []) as Exam[],
      attempts: (attemptsRes.data ?? []) as (Attempt & {
        exams: Exam | null;
        profiles: { display_name: string | null } | null;
      })[],
      configured: true,
    };
  } catch {
    return { exams: [], attempts: [], configured: false };
  }
}

export default async function Home() {
  const { exams, attempts, configured } = await getData();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Hero */}
      <section className="kerchi-card overflow-hidden p-8 sm:p-12">
        <div className="flex flex-col items-start gap-4">
          <span className="chip chip-primary">
            <Sparkles className="size-3" /> 線上模擬考
          </span>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            開始考試吧 — <span className="text-primary">kerchi</span>
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            登入帳號就能進行模擬考，全程專注作答；交卷後自動評分，告訴你哪裡錯、屬於哪個章節，
            還會用能力值雷達圖呈現你的強項與弱項。
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/exams">
                <FileText className="size-4" /> 前往題庫
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/history">
                <History className="size-4" /> 答題記錄
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {!configured && (
        <div className="mt-6 rounded-[var(--radius)] border border-accent/40 bg-[#fff8ec] p-4 text-sm text-[#7a5200]">
          <strong>尚未連上資料庫。</strong> 請建立 Supabase 專案、執行 <code>supabase/schema.sql</code>，
          並把金鑰填到 <code>.env.local</code>（參考 <code>.env.local.example</code>）。
        </div>
      )}

      {/* 最新題庫 */}
      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">最新題庫</h2>
          <Link href="/exams" className="flex items-center gap-1 text-sm text-primary hover:underline">
            全部 <ArrowRight className="size-4" />
          </Link>
        </div>
        {exams.length === 0 ? (
          <p className="text-sm text-muted-foreground">還沒有題庫。請出題者到後台上傳考卷建立題庫。</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((e) => (
              <ExamCard key={e.id} exam={e} />
            ))}
          </div>
        )}
      </section>

      {/* 最近答題記錄 */}
      {attempts.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">最近答題記錄</h2>
            <Link href="/history" className="flex items-center gap-1 text-sm text-primary hover:underline">
              更多 <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="kerchi-card divide-y divide-border">
            {attempts.map((a) => {
              const g = gradeText(a.score);
              return (
                <Link
                  key={a.id}
                  href={`/history/${a.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-secondary/50"
                >
                  <Trophy className="size-5 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{a.exams?.title ?? "考卷"}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {a.profiles?.display_name ?? "某位同學"}
                      {a.exams ? ` · ${examMeta(a.exams)}` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tnum text-lg font-bold">{pct(a.score)}</div>
                    <div className={`text-xs font-medium ${TONE_TEXT[g.tone]}`}>{g.label}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
