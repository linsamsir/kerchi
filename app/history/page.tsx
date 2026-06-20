import { createClient, getSessionUser } from "@/lib/supabase/server";
import { HistoryTabs } from "./history-tabs";
import type { Attempt, Exam } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "答題記錄" };

type Row = Attempt & {
  exams: Exam | null;
  profiles?: { display_name: string | null } | null;
};

async function getData() {
  try {
    const supabase = await createClient();
    const user = await getSessionUser();

    const allRes = await supabase
      .from("attempts")
      .select("*, exams(id,title,subject,stage,semester,grade), profiles(display_name)")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(50);

    let mine: Row[] = [];
    if (user) {
      const mineRes = await supabase
        .from("attempts")
        .select("*, exams(id,title,subject,stage,semester,grade)")
        .eq("status", "submitted")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(100);
      mine = (mineRes.data ?? []) as Row[];
    }

    return { mine, all: (allRes.data ?? []) as Row[], loggedIn: !!user };
  } catch {
    return { mine: [], all: [], loggedIn: false };
  }
}

export default async function HistoryPage() {
  const { mine, all, loggedIn } = await getData();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">答題記錄</h1>
      <p className="mb-6 text-sm text-muted-foreground">查看正確率、作答時間、錯題與能力值分布。</p>
      <HistoryTabs mine={mine} all={all} loggedIn={loggedIn} />
    </div>
  );
}
