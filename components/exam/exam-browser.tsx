"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ExamCard } from "@/components/exam/exam-card";
import { Input } from "@/components/ui/input";
import { STAGES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Exam, Stage } from "@/lib/types";

export function ExamBrowser({ exams }: { exams: Exam[] }) {
  const [stage, setStage] = useState<Stage | "all">("all");
  const [keyword, setKeyword] = useState("");

  const subjects = useMemo(
    () => Array.from(new Set(exams.map((e) => e.subject))).sort(),
    [exams],
  );
  const [subject, setSubject] = useState<string | "all">("all");

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return exams.filter((e) => {
      if (stage !== "all" && e.stage !== stage) return false;
      if (subject !== "all" && e.subject !== subject) return false;
      if (kw && !(`${e.title} ${e.subject} ${e.description ?? ""}`.toLowerCase().includes(kw)))
        return false;
      return true;
    });
  }, [exams, stage, subject, keyword]);

  return (
    <div>
      <div className="kerchi-card mb-6 space-y-4 p-4">
        {/* 學制 */}
        <div className="flex flex-wrap gap-2">
          <Chip active={stage === "all"} onClick={() => setStage("all")}>
            全部學制
          </Chip>
          {STAGES.map((s) => (
            <Chip key={s.value} active={stage === s.value} onClick={() => setStage(s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>

        {/* 科目 */}
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip active={subject === "all"} onClick={() => setSubject("all")}>
              全部科目
            </Chip>
            {subjects.map((s) => (
              <Chip key={s} active={subject === s} onClick={() => setSubject(s)}>
                {s}
              </Chip>
            ))}
          </div>
        )}

        {/* 搜尋 */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋考卷標題、科目…"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">沒有符合條件的題庫。</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => (
            <ExamCard key={e.id} exam={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
