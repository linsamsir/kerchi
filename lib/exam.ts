import { STAGE_LABEL, SEMESTERS } from "@/lib/constants";
import type { ChapterStat, Exam } from "@/lib/types";

/** "國小・上學期・數學" 之類的標籤 */
export function examMeta(
  exam: Pick<Exam, "stage" | "grade" | "semester" | "subject">,
): string {
  const parts: string[] = [STAGE_LABEL[exam.stage] ?? exam.stage];
  if (exam.grade) parts.push(exam.grade);
  const sem = SEMESTERS.find((s) => s.value === exam.semester);
  if (sem) parts.push(sem.label);
  parts.push(exam.subject);
  return parts.join("・");
}

export interface RadarAxis {
  axis: string;
  value: number; // 0–100
  correct: number;
  total: number;
}

/** per_chapter → 雷達圖各軸（依正確率） */
export function radarFromPerChapter(
  perChapter: Record<string, ChapterStat> | null | undefined,
): RadarAxis[] {
  if (!perChapter) return [];
  return Object.entries(perChapter)
    .map(([axis, { correct, total }]) => ({
      axis,
      correct,
      total,
      value: total > 0 ? Math.round((correct / total) * 100) : 0,
    }))
    .sort((a, b) => a.axis.localeCompare(b.axis, "zh-Hant"));
}

export type Tone = "success" | "primary" | "accent" | "destructive";

/** 分數 → 評語 + 色彩 */
export function gradeText(score: number | null | undefined): {
  label: string;
  tone: Tone;
} {
  const s = score ?? 0;
  if (s >= 90) return { label: "太強了！", tone: "success" };
  if (s >= 75) return { label: "很不錯", tone: "primary" };
  if (s >= 60) return { label: "再加油", tone: "accent" };
  return { label: "多練習", tone: "destructive" };
}

/** tone → 文字色（用字面 class，Tailwind 才掃得到） */
export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  primary: "text-primary",
  accent: "text-[#9a6400]",
  destructive: "text-destructive",
};
