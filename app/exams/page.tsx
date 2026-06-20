import { createClient } from "@/lib/supabase/server";
import { ExamBrowser } from "@/components/exam/exam-browser";
import type { Exam } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "題庫" };

async function getExams(): Promise<Exam[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("exams_with_counts")
      .select("*")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    return (data ?? []) as Exam[];
  } catch {
    return [];
  }
}

export default async function ExamsPage() {
  const exams = await getExams();
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">題庫</h1>
      <p className="mb-6 text-sm text-muted-foreground">挑一份考卷，開始模擬考。</p>
      <ExamBrowser exams={exams} />
    </div>
  );
}
