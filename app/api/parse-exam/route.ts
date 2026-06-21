import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Provider 選擇：有 GOOGLE_API_KEY 預設用 Gemini；可用 PARSE_PROVIDER 強制 (gemini|anthropic)。
const PROVIDER = (
  process.env.PARSE_PROVIDER ||
  (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY ? "gemini" : "anthropic")
).toLowerCase();

const ANTHROPIC_MODEL = process.env.ANTHROPIC_PARSE_MODEL || "claude-sonnet-4-6";
const GEMINI_MODEL = process.env.GEMINI_PARSE_MODEL || "gemini-2.5-flash";

const ALLOWED_MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type ImageInput = { data: string; mediaType: string };
type Meta = { stage?: string; grade?: string; semester?: string; subject?: string };

// Anthropic strict tool 的 JSON schema（每個物件 additionalProperties:false）。
const EXAM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    subject: { type: "string" },
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["single_choice", "multiple_choice", "true_false", "fill_blank", "fill_text"],
          },
          stem: { type: "string" },
          passage: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { key: { type: "string" }, text: { type: "string" } },
              required: ["key", "text"],
            },
          },
          answer: { type: "array", items: { type: "string" } },
          explanation: { type: "string" },
          chapter: { type: "string" },
          skill_tags: { type: "array", items: { type: "string" } },
          points: { type: "integer" },
        },
        required: [
          "type",
          "stem",
          "passage",
          "options",
          "answer",
          "explanation",
          "chapter",
          "skill_tags",
          "points",
        ],
      },
    },
  },
  required: ["title", "subject", "questions"],
} as const;

function buildPrompt(meta: Meta) {
  return `你正在協助把考卷的翻拍照片整理成線上題庫。請仔細閱讀圖片中的每一道題目，整理成結構化資料。全部用繁體中文。

【只收「可自動批改」的題目】
要擷取：單選、多選、是非、填空（直接書寫或同音字）。
請「略過、不要輸出」：問答題、作文題、需要寫出計算過程或解釋的應用題，以及任何無法用標準答案判定對錯的題目。

【題型 type 與選項】
- single_choice 單選、multiple_choice 多選、true_false 是非：
  - options 請「保留考卷原本的標號」（例如 ①②③④、甲乙丙丁、A B C D）；key 放原標號、text 放選項文字。
  - 是非題 options 用 [{"key":"true","text":"對"},{"key":"false","text":"錯"}]。
  - answer 放正確選項的 key 陣列（多選可多個）。
  - 「把代號填進句子」的題目（例如選成語填數字代號）→ 拆成多個 single_choice，一句一題，options 放共用的選項池。
  - 連連看 → 拆成多個 single_choice，左邊項目當題幹，右邊可選項當 options。
- 填空題請依「答案型態」分兩種：
  · 答案是「一個國字」（寫國字、改錯字）→ type=fill_blank，並「自行產生 4 個同音不同字選項」：1 個正確字 + 3 個讀音相同、常見會寫錯的同音誘答字；key 用 A B C D；answer 放正確字的 key；options 的 text 放那 4 個字；stem 用 ___ 標出空格並盡量附注音（例如「貝___（ㄎㄜˊ）」）；explanation 寫正確字的注音與詞義。誘答字避免太冷僻或聲調不同。
  · 答案是「注音」或「數值/單位」→ type=fill_text；options 留空 []；answer 放可接受的正確寫法（數值放 ["19"]、注音放 ["ㄎㄜˊ"]）。同音字不適用，不要硬湊。

【passage 短文】閱讀測驗：把短文原文放進該篇所有子題的 passage 欄位（內容相同）；沒有短文就填空字串 ""。

【其他】explanation 寫簡短且正確的解答說明；chapter 判斷章節/主題，全卷控制 3~6 個；skill_tags 1~3 個關鍵字；points 依卷面配分，沒寫就用 1。圖片模糊或不確定的字，在該字後加 [?]，不要亂猜。

這份考卷背景：學制=${meta.stage || "未指定"}、年級=${meta.grade || "未指定"}、學期=${meta.semester || "未指定"}、科目=${meta.subject || "未指定"}。

【輸出格式】輸出「一個 JSON 物件」：{"title":"考卷標題","subject":"科目","questions":[ 每題一個物件 ]}；每題物件含 type、stem、passage、options（[{"key","text"}]）、answer（字串陣列）、explanation、chapter、skill_tags（字串陣列）、points（整數）。只輸出 JSON，不要其他文字。`;
}

function safeJsonParse(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/[{[][\s\S]*[}\]]/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function parseWithGemini(images: ImageInput[], prompt: string): Promise<Response> {
  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    return Response.json(
      { error: "尚未設定 GOOGLE_API_KEY，無法使用 Gemini 解析。請在環境變數設定金鑰。" },
      { status: 501 },
    );
  }
  const parts = [
    ...images.map((img) => ({ inlineData: { mimeType: img.mediaType, data: img.data } })),
    { text: prompt },
  ];
  const t0 = Date.now();
  console.log(`[parse-exam] provider=gemini model=${GEMINI_MODEL} images=${images.length}`);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 16384,
            temperature: 0.2,
          },
        }),
      },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await res.json();
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      console.error(`[parse-exam] gemini error after ${Date.now() - t0}ms:`, msg);
      return Response.json({ error: `Gemini 解析失敗：${msg}` }, { status: 500 });
    }
    const cand = data?.candidates?.[0];
    const finish = cand?.finishReason;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text: string = (cand?.content?.parts || []).map((p: any) => p?.text || "").join("");
    if (!text) {
      const why = data?.promptFeedback?.blockReason || finish || "無內容";
      return Response.json(
        { error: `Gemini 未回傳內容（${why}）。請換清楚一點的照片再試。` },
        { status: 422 },
      );
    }
    const exam = safeJsonParse(text);
    if (!exam || typeof exam !== "object") {
      const hint = finish === "MAX_TOKENS" ? "（輸出過長被截斷，請一次少傳幾張、分批掃描）" : "";
      return Response.json({ error: `Gemini 回傳的 JSON 無法解析${hint}。` }, { status: 422 });
    }
    const qn = Array.isArray((exam as { questions?: unknown[] }).questions)
      ? (exam as { questions: unknown[] }).questions.length
      : 0;
    console.log(`[parse-exam] gemini done in ${Date.now() - t0}ms parsed ${qn} questions`);
    return Response.json({ exam });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[parse-exam] gemini exception after ${Date.now() - t0}ms:`, msg);
    return Response.json({ error: `Gemini 解析失敗：${msg}` }, { status: 500 });
  }
}

async function parseWithAnthropic(images: ImageInput[], prompt: string): Promise<Response> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "尚未設定 ANTHROPIC_API_KEY，無法使用 Claude 解析。請在環境變數設定金鑰，或改用 Gemini。" },
      { status: 501 },
    );
  }
  const client = new Anthropic({ apiKey });
  const content = [
    ...images.map((img) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: img.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        data: img.data,
      },
    })),
    { type: "text" as const, text: prompt },
  ];
  const tool = {
    name: "emit_exam",
    description: "輸出整理後的考卷題庫",
    input_schema: EXAM_SCHEMA,
    strict: true,
  };
  const t0 = Date.now();
  console.log(`[parse-exam] provider=anthropic model=${ANTHROPIC_MODEL} images=${images.length}`);
  try {
    const stream = client.messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [tool as any],
      tool_choice: { type: "tool", name: "emit_exam" },
      messages: [{ role: "user", content }],
    });
    const res = await stream.finalMessage();
    const toolBlock = res.content.find((b) => b.type === "tool_use");
    console.log(`[parse-exam] anthropic done in ${Date.now() - t0}ms stop=${res.stop_reason}`);
    if (!toolBlock || toolBlock.type !== "tool_use") {
      return Response.json(
        { error: "AI 未能解析出題目，請換清楚一點、單張的照片再試。" },
        { status: 422 },
      );
    }
    return Response.json({ exam: toolBlock.input });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[parse-exam] anthropic error after ${Date.now() - t0}ms:`, msg);
    return Response.json({ error: `AI 解析失敗：${msg}` }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // 驗證身分：限出題者 / 管理員
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "請先登入。" }, { status: 401 });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile || (profile.role !== "provider" && profile.role !== "admin")) {
      return Response.json({ error: "只有出題者或管理員可以使用。" }, { status: 403 });
    }
  } catch {
    return Response.json({ error: "驗證失敗。" }, { status: 401 });
  }

  let body: { images?: ImageInput[] } & Meta;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "請求格式錯誤。" }, { status: 400 });
  }

  const images = (body.images ?? []).slice(0, 8);
  if (images.length === 0) {
    return Response.json({ error: "請至少上傳一張考卷照片。" }, { status: 400 });
  }
  const badImage = images.find((i) => !ALLOWED_MEDIA.includes(i.mediaType));
  if (badImage) {
    return Response.json(
      {
        error: `不支援的圖片格式：${badImage.mediaType || "未知"}。請改用 JPEG / PNG / WebP（iPhone 的 HEIC 請先轉成 JPEG）。`,
      },
      { status: 400 },
    );
  }

  const prompt = buildPrompt(body);
  return PROVIDER === "anthropic"
    ? parseWithAnthropic(images, prompt)
    : parseWithGemini(images, prompt);
}
