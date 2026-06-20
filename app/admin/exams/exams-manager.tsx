"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Eye, ListChecks, Loader2, Trash2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { examMeta } from "@/lib/exam";
import type { Exam } from "@/lib/types";

export function ExamsManager({ initial }: { initial: Exam[] }) {
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [exams, setExams] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Exam | null>(null);

  async function togglePublish(exam: Exam) {
    setBusy(exam.id);
    const next = !exam.is_published;
    const { error } = await supabase.from("exams").update({ is_published: next }).eq("id", exam.id);
    if (!error) {
      setExams((prev) => prev.map((e) => (e.id === exam.id ? { ...e, is_published: next } : e)));
    }
    setBusy(null);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(toDelete.id);
    const { error } = await supabase.from("exams").delete().eq("id", toDelete.id);
    if (!error) setExams((prev) => prev.filter((e) => e.id !== toDelete.id));
    setBusy(null);
    setToDelete(null);
  }

  if (exams.length === 0) {
    return (
      <div className="kerchi-card p-10 text-center">
        <p className="text-sm text-muted-foreground">你還沒有建立任何考卷。</p>
        <Button asChild className="mt-4">
          <Link href="/admin/upload">
            <Upload className="size-4" /> 拍照建題
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="kerchi-card divide-y divide-border">
        {exams.map((exam) => (
          <div key={exam.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold">{exam.title}</span>
                {exam.is_published ? (
                  <Badge variant="success">已發布</Badge>
                ) : (
                  <Badge variant="muted">草稿</Badge>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span>{examMeta(exam)}</span>
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="size-3" /> {exam.question_count ?? 0} 題
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={exam.is_published}
                  onCheckedChange={() => togglePublish(exam)}
                  disabled={busy === exam.id}
                />
                <span className="hidden text-xs text-muted-foreground sm:inline">發布</span>
              </div>
              <Button asChild variant="ghost" size="icon" title="查看">
                <Link href={`/exams/${exam.id}`}>
                  <Eye className="size-4" />
                </Link>
              </Button>
              <button
                type="button"
                onClick={() => setToDelete(exam)}
                disabled={busy === exam.id}
                className="rounded-md p-2 text-muted-foreground hover:bg-[#fee2e2] hover:text-destructive"
                title="刪除"
              >
                {busy === exam.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>刪除考卷？</DialogTitle>
            <DialogDescription>
              將刪除「{toDelete?.title}」與其所有題目，相關作答記錄也會一併移除。此動作無法復原。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setToDelete(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={!!busy}>
              確定刪除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
