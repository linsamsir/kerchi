import Link from "next/link";
import { Clock, ShieldAlert } from "lucide-react";
import { examMeta, gradeText, TONE_TEXT } from "@/lib/exam";
import { formatDate, formatDuration, pct } from "@/lib/utils";
import type { Attempt, Exam } from "@/lib/types";

type Row = Attempt & {
  exams: Exam | null;
  profiles?: { display_name: string | null } | null;
};

export function AttemptRow({ attempt, showName }: { attempt: Row; showName?: boolean }) {
  const g = gradeText(attempt.score);
  return (
    <Link href={`/history/${attempt.id}`} className="flex items-center gap-4 p-4 hover:bg-secondary/50">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{attempt.exams?.title ?? "考卷"}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {attempt.exams && <span>{examMeta(attempt.exams)}</span>}
          {showName && <span>· {attempt.profiles?.display_name ?? "某位同學"}</span>}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {formatDuration(attempt.duration_seconds)}
          </span>
          {(attempt.violations_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-destructive">
              <ShieldAlert className="size-3" /> 中斷 {attempt.violations_count}
            </span>
          )}
          <span>{formatDate(attempt.submitted_at)}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="tnum text-lg font-bold">{pct(attempt.score)}</div>
        <div className={`text-xs font-medium ${TONE_TEXT[g.tone]}`}>{g.label}</div>
      </div>
    </Link>
  );
}
