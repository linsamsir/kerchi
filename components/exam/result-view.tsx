"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, RefreshCw, ShieldAlert, Target, XCircle } from "lucide-react";
import { AbilityRadar } from "@/components/exam/ability-radar";
import { OptionList } from "@/components/exam/option-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QUESTION_TYPE_LABEL } from "@/lib/constants";
import { gradeText, radarFromPerChapter, TONE_TEXT } from "@/lib/exam";
import { formatDuration } from "@/lib/utils";
import type { Attempt, ReviewItem } from "@/lib/types";

interface Props {
  attempt: Attempt;
  examId: string;
  examTitle: string;
  examMetaText: string;
  ownerName: string;
  reviewItems: ReviewItem[] | null;
}

export function ResultView({
  attempt,
  examId,
  examTitle,
  examMetaText,
  ownerName,
  reviewItems,
}: Props) {
  const [wrongOnly, setWrongOnly] = useState(false);
  const g = gradeText(attempt.score);
  const radar = radarFromPerChapter(attempt.per_chapter);
  const items = reviewItems ?? [];
  const shown = wrongOnly ? items.filter((i) => !i.is_correct) : items;
  const wrongCount = items.filter((i) => !i.is_correct).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* 分數 */}
      <div className="kerchi-card overflow-hidden">
        <div className="border-b border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">{examMetaText}</p>
          <h1 className="mt-1 text-xl font-bold">{examTitle}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{ownerName}</p>

          <div className="mt-5 flex items-end justify-center gap-1">
            <span className="tnum text-6xl font-extrabold leading-none">
              {attempt.score != null ? Math.round(attempt.score) : "—"}
            </span>
            <span className="mb-1 text-2xl font-bold text-muted-foreground">分</span>
          </div>
          <p className={`mt-2 text-lg font-bold ${TONE_TEXT[g.tone]}`}>{g.label}</p>
        </div>

        <div className="grid grid-cols-3 divide-x divide-border">
          <Stat
            icon={<Target className="size-4 text-primary" />}
            label="答對"
            value={`${attempt.correct_count ?? 0}/${attempt.question_count ?? 0}`}
          />
          <Stat
            icon={<Clock className="size-4 text-primary" />}
            label="作答時間"
            value={formatDuration(attempt.duration_seconds)}
          />
          <Stat
            icon={<ShieldAlert className="size-4 text-primary" />}
            label="中斷次數"
            value={`${attempt.violations_count ?? 0}`}
          />
        </div>
      </div>

      {/* 能力值雷達 */}
      {radar.length > 0 && (
        <section className="kerchi-card mt-6 p-6">
          <h2 className="mb-1 text-lg font-bold">能力值分布</h2>
          <p className="mb-4 text-sm text-muted-foreground">依各章節的答對率呈現你的強項與弱項。</p>
          <AbilityRadar data={radar} />
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {radar.map((r) => (
              <div key={r.axis} className="flex items-center gap-3 rounded-[var(--radius)] bg-secondary/50 px-3 py-2">
                <span className="flex-1 truncate text-sm font-medium">{r.axis}</span>
                <span className="tnum text-xs text-muted-foreground">
                  {r.correct}/{r.total}
                </span>
                <span className="tnum w-10 text-right text-sm font-bold">{r.value}%</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 逐題檢討 */}
      <section className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">逐題檢討</h2>
          {reviewItems && wrongCount > 0 && (
            <button
              type="button"
              onClick={() => setWrongOnly((v) => !v)}
              className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {wrongOnly ? "顯示全部" : `只看錯題（${wrongCount}）`}
            </button>
          )}
        </div>

        {!reviewItems ? (
          <p className="kerchi-card p-6 text-center text-sm text-muted-foreground">
            逐題檢討（含正確答案）僅限本人或管理員查看。
          </p>
        ) : (
          <div className="space-y-4">
            {shown.map((it, idx) => {
              const showPassage = !!it.passage && it.passage !== shown[idx - 1]?.passage;
              return (
                <div key={it.question_id} className="kerchi-card p-5">
                  {showPassage && (
                    <div className="mb-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-secondary/40 p-3 text-sm leading-relaxed text-muted-foreground">
                      {it.passage}
                    </div>
                  )}
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex size-6 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                      {it.order_index + 1}
                    </span>
                    <span className="chip">{QUESTION_TYPE_LABEL[it.type]}</span>
                    {it.chapter && <span className="chip chip-primary">{it.chapter}</span>}
                    <span className="ml-auto inline-flex items-center gap-1">
                      <Clock className="size-3" /> {formatDuration(it.time_spent_seconds)}
                    </span>
                    {it.is_correct ? (
                      <Badge variant="success">
                        <CheckCircle2 className="size-3" /> 答對
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="size-3" /> 答錯
                      </Badge>
                    )}
                  </div>

                  <p className="mb-3 whitespace-pre-wrap text-base font-medium leading-relaxed">{it.stem}</p>

                  {it.type === "fill_text" ? (
                    <div className="space-y-2">
                      <div
                        className={`rounded-[var(--radius)] border p-3 text-sm ${
                          it.is_correct ? "border-success bg-[#dcfce7]" : "border-destructive bg-[#fee2e2]"
                        }`}
                      >
                        <span className="text-muted-foreground">你的作答：</span>
                        <span className="font-medium">{it.user_answer?.[0] || "（未作答）"}</span>
                      </div>
                      {!it.is_correct && (
                        <div className="rounded-[var(--radius)] border border-success bg-[#dcfce7] p-3 text-sm">
                          <span className="text-muted-foreground">正確答案：</span>
                          <span className="font-medium">{it.correct_answer.join("、")}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <OptionList
                      type={it.type}
                      options={it.options}
                      selected={it.user_answer}
                      correct={it.correct_answer}
                    />
                  )}

                  {it.explanation && (
                    <div className="mt-3 rounded-[var(--radius)] border border-border bg-secondary/40 p-3 text-sm">
                      <span className="font-bold text-primary">解答：</span>
                      <span className="whitespace-pre-wrap text-muted-foreground">{it.explanation}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 動作 */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/exams/${examId}`}>
            <RefreshCw className="size-4" /> 再考一次
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/history">返回答題記錄</Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-4">
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="tnum text-lg font-bold">{value}</div>
    </div>
  );
}
