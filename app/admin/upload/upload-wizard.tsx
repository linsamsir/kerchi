"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Sparkles, Save, X, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { QuestionEditor, type EditableQuestion } from "@/components/admin/question-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { STAGES, SEMESTERS, SUBJECT_SUGGESTIONS, DEFAULT_PROCTOR_PASSWORD } from "@/lib/constants";
import type { ParsedExam, ParsedQuestion, Stage } from "@/lib/types";

function uid() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `q${Math.random()}`;
}

function toEditable(q: ParsedQuestion): EditableQuestion {
  return {
    id: uid(),
    type: q.type,
    stem: q.stem ?? "",
    passage: q.passage ?? "",
    options: q.options ?? [],
    answer: q.answer ?? [],
    explanation: q.explanation ?? "",
    chapter: q.chapter ?? "",
    skill_tags: q.skill_tags ?? [],
    points: q.points || 1,
  };
}

function blankQuestion(): EditableQuestion {
  return {
    id: uid(),
    type: "single_choice",
    stem: "",
    passage: "",
    options: [
      { key: "A", text: "" },
      { key: "B", text: "" },
      { key: "C", text: "" },
      { key: "D", text: "" },
    ],
    answer: [],
    explanation: "",
    chapter: "",
    skill_tags: [],
    points: 1,
  };
}

function fileToImage(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      resolve({ data: s.split(",")[1] ?? "", mediaType: file.type || "image/jpeg" });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function UploadWizard() {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  if (!supabaseRef.current) supabaseRef.current = createClient();
  const supabase = supabaseRef.current;

  const [stage, setStage] = useState<Stage | "">("");
  const [grade, setGrade] = useState("");
  const [semester, setSemester] = useState("");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [proctorPassword, setProctorPassword] = useState(DEFAULT_PROCTOR_PASSWORD);
  const [timeLimit, setTimeLimit] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const stageInfo = STAGES.find((s) => s.value === stage);

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => [...prev, ...arr].slice(0, 8));
    arr.forEach((f) => {
      const url = URL.createObjectURL(f);
      setPreviews((prev) => [...prev, url].slice(0, 8));
    });
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleParse() {
    setParseError(null);
    if (files.length === 0) {
      setParseError("請先上傳至少一張考卷照片。");
      return;
    }
    setParsing(true);
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 180_000);
    try {
      const images = await Promise.all(files.map(fileToImage));
      const res = await fetch("/api/parse-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, stage, grade, semester, subject }),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok) {
        setParseError(json.error || "解析失敗。");
        return;
      }
      const exam = json.exam as ParsedExam;
      const parsed = exam.questions ?? [];
      if (!title && exam.title) setTitle(exam.title);
      if (!subject && exam.subject) setSubject(exam.subject);
      setQuestions((prev) => [...prev, ...parsed.map(toEditable)]);
      if (parsed.length === 0) {
        setParseError(
          "AI 沒有從照片辨識到可自動批改的題目（問答／作文題會被略過）。請換清楚一點、單張的照片，或用下方「新增題目」手動建立。",
        );
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setParseError("AI 解析逾時（照片太多或太大）。建議一次 1~2 張、單面拍清楚再試。");
      } else {
        setParseError(e instanceof Error ? e.message : "解析失敗。");
      }
    } finally {
      clearTimeout(tid);
      setParsing(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!stage) return setError("請選擇學制。");
    if (!subject.trim()) return setError("請填寫科目。");
    if (!title.trim()) return setError("請填寫考卷標題。");
    if (questions.length === 0) return setError("至少要有一題。");

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("尚未登入");

      // 上傳原始照片（保留來源）
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const safe = f.name.replace(/[^\w.\-]/g, "_");
        const path = `${user.id}/${Date.now()}-${i}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("exam-uploads")
          .upload(path, f, { contentType: f.type, upsert: false });
        if (!upErr) {
          const { data } = supabase.storage.from("exam-uploads").getPublicUrl(path);
          urls.push(data.publicUrl);
        }
      }

      const { data: exam, error: examErr } = await supabase
        .from("exams")
        .insert({
          title: title.trim(),
          stage,
          grade: grade.trim() || null,
          semester: semester ? Number(semester) : null,
          subject: subject.trim(),
          description: description.trim() || null,
          source_images: urls,
          proctor_password: proctorPassword.trim() || "0000",
          time_limit_minutes: timeLimit ? Number(timeLimit) : null,
          is_published: isPublished,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (examErr || !exam) throw examErr ?? new Error("建立考卷失敗");

      const rows = questions.map((q, idx) => ({
        exam_id: exam.id,
        order_index: idx,
        type: q.type,
        stem: q.stem,
        passage: q.passage || null,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation || null,
        chapter: q.chapter || null,
        skill_tags: q.skill_tags,
        points: q.points,
      }));
      const { error: qErr } = await supabase.from("questions").insert(rows);
      if (qErr) throw qErr;

      router.push(`/exams/${exam.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "儲存失敗。");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 分類 */}
      <section className="kerchi-card p-5">
        <h2 className="mb-4 text-lg font-bold">1. 考卷分類</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>學制 *</Label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as Stage)}
              className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-input bg-card px-3 text-sm"
            >
              <option value="">請選擇</option>
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {stageInfo?.hasSemester && (
            <div className="space-y-1.5">
              <Label>學期</Label>
              <select
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="h-10 w-full rounded-[calc(var(--radius)-4px)] border border-input bg-card px-3 text-sm"
              >
                <option value="">不指定</option>
                {SEMESTERS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>年級（選填）</Label>
            <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="例如 三年級" />
          </div>
          <div className="space-y-1.5">
            <Label>科目 *</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="例如 數學"
              list="subject-suggestions"
            />
            <datalist id="subject-suggestions">
              {SUBJECT_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>
      </section>

      {/* 上傳 + 解析 */}
      <section className="kerchi-card p-5">
        <h2 className="mb-1 text-lg font-bold">2. 上傳考卷照片</h2>
        <p className="mb-4 text-sm text-muted-foreground">最多 8 張。AI 會辨識題目並建立題庫，你之後可以再修改。</p>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {previews.map((src, i) => (
            <div key={i} className="relative aspect-square overflow-hidden rounded-[var(--radius)] border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`照片 ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute right-1 top-1 rounded-full bg-foreground/70 p-1 text-white"
                aria-label="移除"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {files.length < 8 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius)] border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary">
              <ImagePlus className="size-6" />
              <span className="text-xs">加照片</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
            </label>
          )}
        </div>

        <Button onClick={handleParse} disabled={parsing || files.length === 0} className="mt-4">
          {parsing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {parsing ? "AI 解析中…（約需數十秒）" : "AI 解析建題"}
        </Button>
        {parseError && <p className="mt-3 text-sm text-destructive">{parseError}</p>}
      </section>

      {/* 題目 review */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">3. 確認題目（{questions.length}）</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuestions((p) => [...p, blankQuestion()])}
          >
            <Plus className="size-4" /> 新增題目
          </Button>
        </div>
        {questions.length === 0 ? (
          <p className="kerchi-card p-6 text-center text-sm text-muted-foreground">
            還沒有題目。上傳照片用 AI 解析，或手動新增題目。
          </p>
        ) : (
          <div className="space-y-3">
            {questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                index={i}
                q={q}
                onChange={(nq) => setQuestions((p) => p.map((x) => (x.id === q.id ? nq : x)))}
                onRemove={() => setQuestions((p) => p.filter((x) => x.id !== q.id))}
              />
            ))}
          </div>
        )}
      </section>

      {/* 設定 + 儲存 */}
      <section className="kerchi-card p-5">
        <h2 className="mb-4 text-lg font-bold">4. 考卷設定</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>考卷標題 *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如 三年級數學第一次月考" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>說明（選填）</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-16" />
          </div>
          <div className="space-y-1.5">
            <Label>監考密碼</Label>
            <Input
              value={proctorPassword}
              onChange={(e) => setProctorPassword(e.target.value)}
              placeholder={DEFAULT_PROCTOR_PASSWORD}
            />
            <p className="text-xs text-muted-foreground">考試中離開畫面時，需輸入此密碼才能繼續。</p>
          </div>
          <div className="space-y-1.5">
            <Label>時間限制（分鐘，選填）</Label>
            <Input
              type="number"
              min={1}
              value={timeLimit}
              onChange={(e) => setTimeLimit(e.target.value)}
              placeholder="不填＝不限時"
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} id="pub" />
            <Label htmlFor="pub" className="cursor-pointer">
              立即發布（讓學生可以看到並作答）
            </Label>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <Button onClick={handleSave} disabled={saving} size="lg" className="mt-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {saving ? "儲存中…" : "儲存考卷"}
        </Button>
      </section>
    </div>
  );
}
