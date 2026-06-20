"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuestionOption, QuestionType } from "@/lib/types";

interface Props {
  type: QuestionType;
  options: QuestionOption[];
  selected: string[];
  onToggle?: (key: string) => void;
  /** review 模式：傳入正確答案就會標示對錯，且不可作答 */
  correct?: string[];
  disabled?: boolean;
}

export function OptionList({ type, options, selected, onToggle, correct, disabled }: Props) {
  const multi = type === "multiple_choice";
  const review = correct != null;

  return (
    <div className="grid gap-2">
      {options.map((opt) => {
        const isSelected = selected.includes(opt.key);
        const isCorrect = review && correct!.includes(opt.key);
        const isWrongPick = review && isSelected && !isCorrect;
        const badge =
          type === "true_false"
            ? opt.key === "true"
              ? "○"
              : "✕"
            : opt.key.toUpperCase().slice(0, 2);

        return (
          <button
            key={opt.key}
            type="button"
            disabled={disabled || review}
            onClick={() => onToggle?.(opt.key)}
            className={cn(
              "flex w-full items-center gap-3 rounded-[var(--radius)] border p-3 text-left text-sm transition-colors",
              !review && "hover:border-primary hover:bg-primary-soft/40",
              !review && isSelected
                ? "border-primary bg-primary-soft"
                : "border-border bg-card",
              isCorrect && "border-success bg-[#dcfce7]",
              isWrongPick && "border-destructive bg-[#fee2e2]",
              (disabled || review) && "cursor-default",
            )}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                multi ? "rounded-md" : "rounded-full",
                isSelected && !review && "border-primary bg-primary text-primary-foreground",
                isCorrect && "border-success bg-success text-success-foreground",
                isWrongPick && "border-destructive bg-destructive text-destructive-foreground",
                !isSelected && !isCorrect && "border-border text-muted-foreground",
              )}
            >
              {isCorrect ? (
                <Check className="size-4" />
              ) : isWrongPick ? (
                <X className="size-4" />
              ) : (
                badge
              )}
            </span>
            <span className="flex-1 whitespace-pre-wrap">{opt.text}</span>
          </button>
        );
      })}
    </div>
  );
}
