import { createClient, getSessionUser } from "@/lib/supabase/server";
import { ExamsManager } from "./exams-manager";
import type { Exam } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "我的考卷" };

async function getMyExams(): Promise<Exam[]> {
  try {
    const supabase = await createClient();
    const user = await getSessionUser();
    if (!user) return [];
    const { data } = await supabase
      .from("exams_with_counts")
      .select("*")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });
    return (data ?? []) as Exam[];
  } catch {
    return [];
  }
}

export default async function AdminExamsPage() {
  const exams = await getMyExams();
  return <ExamsManager initial={exams} />;
}
