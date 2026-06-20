"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QUESTION_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { QuestionType } from "@/lib/types";

export interface EditableQuestion {
  id: string;
  type: QuestionType;
  stem: string;
  passage: string;
  options: { key: string; text: string }[];
  answer: string[];
  explanation: string;
  chapter: string;
  skill_tags: string[];
  points: number;
}

const TF_OPTIONS = [
  { key: "true", text: "對" },
  { key: "false", text: "錯" },
];

function nextKey(existing: string[]): string {
  const used = new Set(existing.map((k) => k.toUpperCase()));
  for (let i = 0; i < 26; i++) {
    const k = String.fromCharCode(65 + i);
    if (!used.has(k)) return k;
  }
  return `X${existing.length}`;
}

export function QuestionEditor({
  index,
  q,
  onChange,
  onRemove,
}: {
  index: number;
  q: EditableQuestion;
  onChange: (q: EditableQuestion) => void;
  onRemove: () => void;
}) {
  const isTF = q.type === "true_false";
  const isFillText = q.type === "fill_text";
  const multi = q.type === "multiple_choice";
  const options = isTF ? TF_OPTIONS : q.options;

  function setType(type: QuestionType) {
    if (type === "true_false") {
      onChange({ ...q, type, options: TF_OPTIONS, answer: [] });
    } else if (type === "fill_text") {
      onChange({ ...q, type, options: [], answer: [] });
    } else {
      const reuse = !isTF && !isFillText && q.options.length >= 2;
      const opts = reuse ? q.options : [{ key: "A", text: "" }, { key: "B", text: "" }];
      onChange({ ...q, type, options: opts, answer: isFillText || isTF ? [] : q.answer });
    }
  }

  function toggleAnswer(key: string) {
    if (multi) {
      const has = q.answer.includes(key);
      onChange({ ...q, answer: has ? q.answer.filter((k) => k !== key) : [...q.answer, key] });
    } else {
      onChange({ ...q, answer: [key] });
    }
  }

  return (
    <div className="kerchi-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          {index + 1}
        </span>
        <select
          value={q.type}
          onChange={(e) => setType(e.target.value as QuestionType)}
          className="h-8 rounded-md border border-input bg-card px-2 text-sm"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1.5">
          <label className="text-xs text-muted-foreground">配分</label>
          <Input
            type="number"
            min={1}
            value={q.points}
            onChange={(e) => onChange({ ...q, points: Math.max(1, Number(e.target.value) || 1) })}
            className="h-8 w-16"
          />
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-[#fee2e2] hover:text-destructive"
            aria-label="刪除題目"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      <Textarea
        value={q.passage}
        onChange={(e) => onChange({ ...q, passage: e.target.value })}
        placeholder="閱讀短文（選填；同一篇短文的子題貼相同內容）"
        className="mb-2 min-h-12 bg-secondary/40 text-xs"
      />
      <Textarea
        value={q.stem}
        onChange={(e) => onChange({ ...q, stem: e.target.value })}
        placeholder="題目文字（填空題用 ___ 表示空格）"
        className="mb-3"
      />

      {/* 答案區 */}
      {isFillText ? (
        <div className="mb-3">
          <Input
            value={q.answer.join("、")}
            onChange={(e) =>
              onChange({
                ...q,
                answer: e.target.value.split(/[、,，;；\n]/).map((s) => s.trim()).filter(Boolean),
              })
            }
            placeholder="可接受的正確答案，多個用、分隔（例：殼）"
          />
          <p className="mt-1 text-xs text-muted-foreground">作答會自動忽略空白與全形/半形差異後比對。</p>
        </div>
      ) : (
      <div className="mb-3 space-y-2">
        {options.map((opt, i) => {
          const selected = q.answer.includes(opt.key);
          return (
            <div key={opt.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAnswer(opt.key)}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                  selected
                    ? "border-success bg-success text-success-foreground"
                    : "border-border text-muted-foreground hover:border-primary",
                )}
                title="設為正確答案"
              >
                {isTF ? (opt.key === "true" ? "○" : "✕") : opt.key.toUpperCase().slice(0, 2)}
              </button>
              {isTF ? (
                <span className="flex-1 text-sm">{opt.text}</span>
              ) : (
                <Input
                  value={opt.text}
                  onChange={(e) => {
                    const opts = q.options.map((o) => (o.key === opt.key ? { ...o, text: e.target.value } : o));
                    onChange({ ...q, options: opts });
                  }}
                  placeholder={`選項 ${opt.key}`}
                  className="h-9 flex-1"
                />
              )}
              {!isTF && q.options.length > 2 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...q,
                      options: q.options.filter((o) => o.key !== opt.key),
                      answer: q.answer.filter((a) => a !== opt.key),
                    })
                  }
                  className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                  aria-label="刪除選項"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {!isTF && (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...q,
                options: [...q.options, { key: nextKey(q.options.map((o) => o.key)), text: "" }],
              })
            }
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="size-3.5" /> 新增選項
          </button>
        )}
      </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={q.chapter}
          onChange={(e) => onChange({ ...q, chapter: e.target.value })}
          placeholder="章節 / 主題"
          className="h-9"
        />
        <Input
          value={q.skill_tags.join("、")}
          onChange={(e) =>
            onChange({ ...q, skill_tags: e.target.value.split(/[、,，]/).map((s) => s.trim()).filter(Boolean) })
          }
          placeholder="技能標籤（用、分隔）"
          className="h-9"
        />
      </div>
      <Textarea
        value={q.explanation}
        onChange={(e) => onChange({ ...q, explanation: e.target.value })}
        placeholder="解答說明"
        className="mt-2 min-h-16 text-sm"
      />
      {!isFillText && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <GripVertical className="size-3" /> 點左側圓圈設定正確答案{multi ? "（多選可複選）" : ""}
        </p>
      )}
    </div>
  );
}
