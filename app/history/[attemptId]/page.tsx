import { notFound } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { ResultView } from "@/components/exam/result-view";
import { examMeta } from "@/lib/exam";
import type { Attempt, Exam, ReviewItem } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "成績檢討" };

export default async function AttemptDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;

  type AttemptRow = Attempt & {
    exams: Exam | null;
    profiles: { display_name: string | null } | null;
  };
  let attempt: AttemptRow | null = null;
  let reviewItems: ReviewItem[] | null = null;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("attempts")
      .select("*, exams(id,title,subject,stage,semester,grade), profiles(display_name)")
      .eq("id", attemptId)
      .maybeSingle();
    attempt = (data as AttemptRow | null) ?? null;

    if (attempt) {
      const { data: review, error } = await supabase.rpc("get_attempt_review", {
        p_attempt_id: attemptId,
      });
      reviewItems = error ? null : ((review ?? []) as ReviewItem[]);
    }
  } catch {
    attempt = null;
  }

  if (!attempt || attempt.status !== "submitted") notFound();
  await getSessionUser(); // ensure cookies refreshed

  const examTitle = attempt.exams?.title ?? "考卷";
  const examMetaText = attempt.exams ? examMeta(attempt.exams) : "";
  const ownerName = attempt.profiles?.display_name ?? "某位同學";

  return (
    <ResultView
      attempt={attempt}
      examId={attempt.exam_id}
      examTitle={examTitle}
      examMetaText={examMetaText}
      ownerName={ownerName}
      reviewItems={reviewItems}
    />
  );
}
