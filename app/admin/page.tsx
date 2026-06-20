import Link from "next/link";
import { Upload, BookOpen, Sparkles, ArrowRight } from "lucide-react";
import { createClient, getSessionUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getStats() {
  try {
    const supabase = await createClient();
    const user = await getSessionUser();
    if (!user) return { exams: 0, published: 0 };
    const { data } = await supabase
      .from("exams")
      .select("id,is_published")
      .eq("created_by", user.id);
    const exams = data ?? [];
    return {
      exams: exams.length,
      published: exams.filter((e) => e.is_published).length,
    };
  } catch {
    return { exams: 0, published: 0 };
  }
}

export default async function AdminHome() {
  const stats = await getStats();
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/admin/upload" className="kerchi-card kerchi-card-hover p-6">
          <span className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sparkles className="size-5" />
          </span>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            拍照建題 <ArrowRight className="size-4 text-muted-foreground" />
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            上傳考卷翻拍照片，AI 自動辨識題目、選項、答案與章節，建立題庫。
          </p>
        </Link>

        <Link href="/admin/exams" className="kerchi-card kerchi-card-hover p-6">
          <span className="mb-3 inline-flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <BookOpen className="size-5" />
          </span>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            我的考卷 <ArrowRight className="size-4 text-muted-foreground" />
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            管理已建立的考卷：發布/隱藏、編輯題目、刪除。
          </p>
        </Link>
      </div>

      <div className="kerchi-card flex items-center gap-6 p-6">
        <Stat label="我的考卷" value={stats.exams} />
        <div className="h-10 w-px bg-border" />
        <Stat label="已發布" value={stats.published} />
        <Link
          href="/admin/upload"
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-[var(--radius)] bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-[#4338ca]"
        >
          <Upload className="size-4" /> 開始建題
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="tnum text-3xl font-extrabold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
