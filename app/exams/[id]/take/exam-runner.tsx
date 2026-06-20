"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  Lock,
  Maximize,
  ShieldAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OptionList } from "@/components/exam/option-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QUESTION_TYPE_LABEL } from "@/lib/constants";
import { formatDuration } from "@/lib/utils";
import type { PublicQuestion } from "@/lib/types";

type Phase = "intro" | "loading" | "running" | "submitting";

interface Props {
  examId: string;
  title: string;
  timeLimitMinutes: number | null;
  questionCount: number;
}

interface Violation {
  type: string;
  at: string;
}

function questionAnswered(q: PublicQuestion, ans: Record<string, string[]>): boolean {
  const a = ans[q.id];
  if (!a || a.length === 0) return false;
  if (q.type === "fill_text") return (a[0] ?? "").trim().length > 0;
  return true;
}

export function ExamRunner({ examId, title, timeLimitMinutes, questionCount }: Props) {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [phase, setPhase] = useState<Phase>("intro");
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [times, setTimes] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState(0);

  const [locked, setLocked] = useState(false);
  const [violations, setViolations] = useState(0);
  const [violationLog, setViolationLog] = useState<Violation[]>([]);
  const [unlockPw, setUnlockPw] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  // refs mirrored from state, for use inside event listeners
  const lockedRef = useRef(locked);
  const phaseRef = useRef(phase);
  const currentRef = useRef(current);
  const submittingRef = useRef(false);
  const startGuardRef = useRef(0);
  useEffect(() => void (lockedRef.current = locked), [locked]);
  useEffect(() => void (phaseRef.current = phase), [phase]);
  useEffect(() => void (currentRef.current = current), [current]);

  const total = questions.length || questionCount;
  const answeredCount = useMemo(
    () => questions.filter((q) => questionAnswered(q, answers)).length,
    [questions, answers],
  );
  const limitSeconds = timeLimitMinutes ? timeLimitMinutes * 60 : null;
  const remaining = limitSeconds != null ? Math.max(limitSeconds - elapsed, 0) : null;

  // ---- fullscreen helpers ----
  const enterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch {
      /* user agent may refuse; lockdown still detects blur/visibility */
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* noop */
    }
  }, []);

  // ---- lock on violation ----
  const lock = useCallback((type: string) => {
    if (lockedRef.current || phaseRef.current !== "running") return;
    if (Date.now() - startGuardRef.current < 1200) return; // ignore startup flicker
    lockedRef.current = true;
    setLocked(true);
    setViolations((v) => v + 1);
    setViolationLog((log) => [...log, { type, at: new Date().toISOString() }]);
  }, []);

  // ---- start the exam (user gesture) ----
  const start = useCallback(async () => {
    setLoadError(null);
    setPhase("loading");
    await enterFullscreen();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("尚未登入");

      // 若已有未完成的作答（例如中途重新整理），沿用同一份並「強制鎖定」，
      // 必須輸入監考密碼才能繼續 —— 避免用重新載入換到一份全新、未鎖定的考卷。
      const { data: existing } = await supabase
        .from("attempts")
        .select("id")
        .eq("exam_id", examId)
        .eq("user_id", user.id)
        .eq("status", "in_progress")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let aid: string;
      const resumed = !!existing;
      if (existing) {
        aid = existing.id as string;
      } else {
        const { data: attempt, error: aErr } = await supabase
          .from("attempts")
          .insert({ exam_id: examId, user_id: user.id })
          .select("id")
          .single();
        if (aErr || !attempt) throw aErr ?? new Error("無法建立考試");
        aid = attempt.id as string;
      }

      const { data: qs, error: qErr } = await supabase.rpc("get_exam_questions", {
        p_exam_id: examId,
      });
      if (qErr) throw qErr;
      const list = (qs ?? []) as PublicQuestion[];
      if (list.length === 0) throw new Error("這份考卷還沒有題目");

      setAttemptId(aid);
      setQuestions(list);
      setTimes(Object.fromEntries(list.map((q) => [q.id, 0])));
      startGuardRef.current = Date.now();
      setPhase("running");

      if (resumed) {
        setViolations((v) => v + 1);
        setViolationLog((log) => [
          ...log,
          { type: "重新進入考試（重新整理）", at: new Date().toISOString() },
        ]);
        lockedRef.current = true;
        setLocked(true);
      }
    } catch (e) {
      await exitFullscreen();
      setLoadError(e instanceof Error ? e.message : "發生錯誤，請稍後再試");
      setPhase("intro");
    }
  }, [supabase, examId, enterFullscreen, exitFullscreen]);

  // ---- timer ----
  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      if (lockedRef.current) return;
      setElapsed((e) => e + 1);
      const qid = questions[currentRef.current]?.id;
      if (qid) setTimes((t) => ({ ...t, [qid]: (t[qid] ?? 0) + 1 }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, questions]);

  // ---- submit ----
  const doSubmit = useCallback(async () => {
    if (!attemptId) return;
    setConfirmSubmit(false);
    setSubmitError(null);
    setPhase("submitting");
    submittingRef.current = true;
    try {
      const { data, error } = await supabase.rpc("submit_attempt", {
        p_attempt_id: attemptId,
        p_answers: answers,
        p_times: times,
        p_duration_seconds: elapsed,
        p_violations: violations,
        p_violation_log: violationLog,
      });
      if (error) throw error;
      await exitFullscreen();
      const result = data as { attempt_id: string };
      router.replace(`/history/${result.attempt_id}`);
    } catch (e) {
      submittingRef.current = false;
      setSubmitError(e instanceof Error ? e.message : "交卷失敗，請再試一次");
      setPhase("running");
    }
  }, [supabase, attemptId, answers, times, elapsed, violations, violationLog, examId, router, exitFullscreen]);

  // auto-submit when time runs out
  useEffect(() => {
    if (phase === "running" && remaining === 0) void doSubmit();
  }, [phase, remaining, doSubmit]);

  // ---- lockdown listeners ----
  useEffect(() => {
    if (phase !== "running") return;

    const onVisibility = () => {
      if (document.hidden) lock("切換分頁或視窗縮小");
    };
    const onBlur = () => lock("切換到其他視窗");
    const onFsChange = () => {
      if (!document.fullscreenElement && !submittingRef.current) lock("離開全螢幕");
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onCopy = (e: ClipboardEvent) => e.preventDefault();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("copy", onCopy);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("copy", onCopy);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [phase, lock]);

  // ---- unlock ----
  async function tryUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError(null);
    setUnlocking(true);
    try {
      const { data, error } = await supabase.rpc("check_proctor_password", {
        p_exam_id: examId,
        p_password: unlockPw,
      });
      setUnlocking(false);
      if (error) {
        // 連線失敗時「不」放行（避免被迫離線後用預設密碼繞過自訂密碼），維持鎖定。
        setUnlockError("連線異常，無法驗證密碼，請稍後再試");
        return;
      }
      if (data !== true) {
        setUnlockError("監考密碼錯誤");
        return;
      }
    } catch {
      setUnlocking(false);
      setUnlockError("連線異常，無法驗證密碼，請稍後再試");
      return;
    }
    setUnlockPw("");
    await enterFullscreen();
    startGuardRef.current = Date.now();
    lockedRef.current = false;
    setLocked(false);
  }

  function toggleAnswer(qid: string, key: string, multi: boolean) {
    setAnswers((prev) => {
      const cur = prev[qid] ?? [];
      if (multi) {
        return {
          ...prev,
          [qid]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key],
        };
      }
      return { ...prev, [qid]: [key] };
    });
  }

  // =================== render ===================
  if (phase === "intro" || phase === "loading") {
    return (
      <div className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <span className="mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Maximize className="size-7" />
        </span>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          共 {questionCount} 題{timeLimitMinutes ? ` · 限時 ${timeLimitMinutes} 分鐘` : " · 不限時"}
        </p>
        <div className="mt-6 w-full rounded-[var(--radius)] border border-border bg-secondary/40 p-4 text-left text-sm text-muted-foreground">
          <p className="mb-2 flex items-center gap-2 font-bold text-foreground">
            <ShieldAlert className="size-4 text-primary" /> 按下開始後
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>畫面會進入全螢幕，請專心作答</li>
            <li>離開全螢幕 / 切換視窗會暫停並跳出警示</li>
            <li>需要監考密碼才能解除繼續</li>
          </ul>
        </div>
        {loadError && <p className="mt-4 text-sm text-destructive">{loadError}</p>}
        <Button size="lg" className="mt-6 w-full" onClick={start} disabled={phase === "loading"}>
          {phase === "loading" ? (
            <>
              <Loader2 className="size-4 animate-spin" /> 準備中…
            </>
          ) : (
            <>
              <Maximize className="size-4" /> 進入全螢幕並開始
            </>
          )}
        </Button>
      </div>
    );
  }

  const q = questions[current];

  return (
    <div className="exam-noselect min-h-screen bg-background">
      {/* 頂部狀態列 */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <span className="truncate text-sm font-bold">{title}</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm">
            <Clock className="size-4 text-primary" />
            <span className={`tnum font-semibold ${remaining != null && remaining <= 60 ? "text-destructive" : ""}`}>
              {remaining != null ? formatDuration(remaining) : formatDuration(elapsed)}
            </span>
          </span>
          {violations > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fee2e2] px-2 py-1 text-xs font-semibold text-destructive">
              <AlertTriangle className="size-3" /> {violations}
            </span>
          )}
        </div>
        {/* 進度條 */}
        <div className="h-1 w-full bg-secondary">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${total ? ((current + 1) / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* 題目 */}
      <div className="mx-auto max-w-3xl px-4 py-6">
        {q && (
          <div className="kerchi-card p-5 sm:p-6">
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {current + 1}
              </span>
              <span>/ {total}</span>
              <span className="chip ml-1">{QUESTION_TYPE_LABEL[q.type]}</span>
              {q.chapter && <span className="chip chip-primary">{q.chapter}</span>}
              <span className="ml-auto">{q.points} 分</span>
            </div>

            {q.passage && (
              <div className="mb-4 max-h-60 overflow-auto whitespace-pre-wrap rounded-[var(--radius)] border border-border bg-secondary/40 p-3 text-sm leading-relaxed text-muted-foreground">
                {q.passage}
              </div>
            )}
            <p className="mb-4 whitespace-pre-wrap text-base font-medium leading-relaxed">{q.stem}</p>
            {q.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={q.image_url}
                alt="題目附圖"
                className="mb-4 max-h-72 rounded-[var(--radius)] border border-border object-contain"
              />
            )}

            {q.type === "fill_text" ? (
              <Input
                value={answers[q.id]?.[0] ?? ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: [e.target.value] }))}
                placeholder="在這裡輸入答案"
                autoComplete="off"
                className="text-base"
              />
            ) : (
              <OptionList
                type={q.type}
                options={q.options}
                selected={answers[q.id] ?? []}
                onToggle={(key) => toggleAnswer(q.id, key, q.type === "multiple_choice")}
              />
            )}
          </div>
        )}

        {/* 題目導覽點 */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {questions.map((qq, i) => {
            const done = questionAnswered(qq, answers);
            return (
              <button
                key={qq.id}
                type="button"
                onClick={() => setCurrent(i)}
                className={`size-8 rounded-md text-xs font-semibold transition-colors ${
                  i === current
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-primary-soft text-primary"
                      : "bg-secondary text-muted-foreground hover:bg-muted"
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {submitError && <p className="mt-4 text-sm text-destructive">{submitError}</p>}

        {/* 上一題 / 下一題 / 交卷 */}
        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrent((c) => Math.max(c - 1, 0))}
            disabled={current === 0}
          >
            <ChevronLeft className="size-4" /> 上一題
          </Button>
          {current < total - 1 ? (
            <Button className="ml-auto" onClick={() => setCurrent((c) => Math.min(c + 1, total - 1))}>
              下一題 <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button variant="success" className="ml-auto" onClick={() => setConfirmSubmit(true)}>
              交卷
            </Button>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          已作答 {answeredCount} / {total} 題
        </p>
      </div>

      {/* 鎖定警示（不可關閉，需監考密碼） */}
      <Dialog open={locked}>
        <DialogContent hideClose onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Lock className="size-5" /> 考試已暫停
            </DialogTitle>
            <DialogDescription>
              偵測到你離開了考試畫面（{violationLog[violationLog.length - 1]?.type ?? "離開畫面"}）。
              計時已暫停，請輸入監考密碼以繼續作答。此次中斷已被記錄。
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={tryUnlock} className="mt-4 space-y-3">
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              placeholder="監考密碼"
              value={unlockPw}
              onChange={(e) => setUnlockPw(e.target.value)}
            />
            {unlockError && <p className="text-sm text-destructive">{unlockError}</p>}
            <Button type="submit" className="w-full" disabled={unlocking}>
              {unlocking ? <Loader2 className="size-4 animate-spin" /> : <Maximize className="size-4" />}
              解除並繼續
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 交卷確認 */}
      <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確定要交卷嗎？</DialogTitle>
            <DialogDescription>
              你已作答 {answeredCount} / {total} 題
              {answeredCount < total ? `，還有 ${total - answeredCount} 題未作答。` : "。"}
              交卷後會立即評分。
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
              再檢查一下
            </Button>
            <Button variant="success" onClick={doSubmit} disabled={phase === "submitting"}>
              {phase === "submitting" ? <Loader2 className="size-4 animate-spin" /> : null}
              確定交卷
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
