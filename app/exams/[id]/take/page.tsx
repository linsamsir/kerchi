import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { ExamRunner } from "./exam-runner";
import type { Exam } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "考試中" };

export default async function TakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/exams/${id}/take`)}`);

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
    <ExamRunner
      examId={exam.id}
      title={exam.title}
      timeLimitMinutes={exam.time_limit_minutes}
      questionCount={exam.question_count ?? 0}
    />
  );
}
