import type { Stage, QuestionType } from "@/lib/types";

export const SITE = {
  name: "kerchi",
  tagline: "開始考試吧",
  description: "kerchi — 線上模擬考。登入、應考、自動評分，看見你的能力值分布。",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
};

/** 監考密碼預設值：建立考卷時若未自訂就用這組，與後端 check_proctor_password 的 fallback 一致。 */
export const DEFAULT_PROCTOR_PASSWORD = "0000";

export const STAGES: { value: Stage; label: string; hasSemester: boolean }[] = [
  { value: "kindergarten", label: "幼稚園", hasSemester: false },
  { value: "elementary", label: "國小", hasSemester: true },
  { value: "junior_high", label: "國中", hasSemester: true },
  { value: "senior_high", label: "高中", hasSemester: true },
  { value: "university", label: "大學", hasSemester: false },
  { value: "society", label: "社會", hasSemester: false },
];

export const STAGE_LABEL: Record<Stage, string> = Object.fromEntries(
  STAGES.map((s) => [s.value, s.label]),
) as Record<Stage, string>;

export const SEMESTERS: { value: number; label: string }[] = [
  { value: 1, label: "上學期" },
  { value: 2, label: "下學期" },
];

/** 常見科目建議（可自由輸入其他科目） */
export const SUBJECT_SUGGESTIONS = [
  "國語",
  "國文",
  "數學",
  "英語",
  "英文",
  "自然",
  "社會",
  "生活",
  "物理",
  "化學",
  "生物",
  "地球科學",
  "歷史",
  "地理",
  "公民",
  "健康",
];

export const QUESTION_TYPES: { value: QuestionType; label: string; hint: string }[] = [
  { value: "single_choice", label: "單選題", hint: "四選一 / 多選一" },
  { value: "multiple_choice", label: "多選題", hint: "可複選，全對才得分" },
  { value: "true_false", label: "是非題", hint: "對 / 錯" },
  { value: "fill_text", label: "填空題（直接書寫）", hint: "直接寫國字/注音/數值，系統正規化後比對" },
  { value: "fill_blank", label: "填空題（同音字）", hint: "從同音不同字的選項中選出正確的字" },
];

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = Object.fromEntries(
  QUESTION_TYPES.map((q) => [q.value, q.label]),
) as Record<QuestionType, string>;

/** 是非題固定選項 */
export const TRUE_FALSE_OPTIONS = [
  { key: "true", text: "○（對）" },
  { key: "false", text: "✕（錯）" },
];
