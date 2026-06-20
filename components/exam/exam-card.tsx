import Link from "next/link";
import { FileText, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { examMeta } from "@/lib/exam";
import type { Exam } from "@/lib/types";

export function ExamCard({ exam }: { exam: Exam }) {
  return (
    <Link href={`/exams/${exam.id}`} className="block">
      <article className="kerchi-card kerchi-card-hover h-full p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <FileText className="size-5" />
          </span>
          {!exam.is_published && <Badge variant="muted">草稿</Badge>}
          <Badge variant="primarySoft" className="ml-auto">
            <ListChecks className="size-3" /> {exam.question_count ?? 0} 題
          </Badge>
        </div>
        <h3 className="line-clamp-2 text-base font-bold leading-snug">{exam.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{examMeta(exam)}</p>
        {exam.description && (
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{exam.description}</p>
        )}
      </article>
    </Link>
  );
}
