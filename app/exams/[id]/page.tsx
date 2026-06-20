import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ListChecks, Lock, Maximize2, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StartExamButton } from "@/components/exam/start-exam-button";
import { Badge } from "@/components/ui/badge";
import { examMeta } from "@/lib/exam";
import type { Exam } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ExamDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let exam: Exam | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("exams_with_counts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    exam = (data as Exam) ?? null;
  } catch {
    exam = null;
  }
  if (!exam) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/exams"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> 返回題庫
      </Link>

      <div className="kerchi-card p-6 sm:p-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="primarySoft">{examMeta(exam)}</Badge>
          <Badge variant="muted">
            <ListChecks className="size-3" /> {exam.question_count ?? 0} 題
          </Badge>
          {exam.time_limit_minutes ? (
            <Badge variant="accent">
              <Clock className="size-3" /> {exam.time_limit_minutes} 分鐘
            </Badge>
          ) : (
            <Badge variant="muted">不限時</Badge>
          )}
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight">{exam.title}</h1>
        {exam.description && (
          <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{exam.description}</p>
        )}

        {/* 考試規則 */}
        <div className="mt-6 rounded-[var(--radius)] border border-border bg-secondary/40 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <ShieldAlert className="size-4 text-primary" /> 考試守則
          </h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Maximize2 className="mt-0.5 size-4 shrink-0 text-primary" />
              開始後會進入<strong className="text-foreground">全螢幕</strong>，請專注作答。
            </li>
            <li className="flex items-start gap-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
              中途若離開全螢幕、切換到其他視窗或分頁，畫面會
              <strong className="text-foreground">暫停並跳出警示</strong>，需輸入
              <strong className="text-foreground">監考密碼</strong>才能繼續。
            </li>
            <li className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
              系統會記錄你的作答時間與每一題花的時間。
            </li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <StartExamButton examId={exam.id} />
          {(exam.question_count ?? 0) === 0 && (
            <span className="text-sm text-destructive">這份考卷還沒有題目。</span>
          )}
        </div>
      </div>
    </div>
  );
}
