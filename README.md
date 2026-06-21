# kerchi · 開始考試吧

> kerchi（「考試」的台語諧音）— 線上模擬考。登入帳號開始應考，全程專注作答；交卷後自動評分，告訴你哪裡錯、屬於哪個章節，並以能力值雷達圖呈現強弱項。

技術棧：**Next.js 16（App Router）· TypeScript · Tailwind v4 · shadcn 風格元件 · Supabase（Auth + Postgres + RLS + Storage）· Claude 視覺 API · 部署於 Vercel**。

---

## 功能

**使用者（學生）**
- 帳號／密碼／信箱 註冊登入（不需其他資訊）
- 從題庫挑考卷 → 進入**全螢幕鎖定**模擬考
  - 偵測到離開全螢幕、切換視窗／分頁、視窗縮小，會**暫停計時並跳出警示**，需輸入**監考密碼**才能繼續，並記錄中斷次數
- 交卷後自動評分：分數、答對題數、哪題錯、屬於哪個章節、逐題解答
- **能力值雷達圖**（依各章節答對率，帶生長動畫）
- 記錄作答總時間與每題花費時間
- 不進考試也能瀏覽題庫、查看自己與其他人的答題記錄

**提供者／管理員**
- **拍照建題**：上傳考卷翻拍照片 → Claude 視覺辨識題目／選項／答案 → 自動分類章節、產生簡易解答 → 進入可編輯的審稿介面 → 存入題庫
- 也可純手動出題
- 管理考卷：發布／隱藏、刪除
- 題型：單選、多選、是非、填空（同音字選項）

**考卷分類**：幼稚園／國小／國中／高中（皆含上下學期）／大學／社會 × 科目 × 章節

---

## 安全設計（防作弊）

題目的**正確答案與解析不會傳到學生瀏覽器**：
- 學生作答時透過 `get_exam_questions()` RPC 取得「去掉答案」的題目
- 評分在伺服器端的 `submit_attempt()`（`SECURITY DEFINER`）完成
- 交卷後逐題檢討透過 `get_attempt_review()`，僅限本人／管理員

> ⚠️ 瀏覽器無法真正阻止作業系統層級的縮小／Alt-Tab，這是所有網頁的共同限制。kerchi 採用「偵測 → 全屏警示 → 暫停 → 需監考密碼解除 → 記錄違規」的實務等效做法。

---

## 快速開始

### 1. 安裝
```bash
npm install
```

### 2. 建立 Supabase 專案
1. 到 [supabase.com](https://supabase.com) 開一個新專案。
2. **SQL Editor** → 貼上整份 [`supabase/schema.sql`](supabase/schema.sql) → **RUN**（會建立資料表、RLS、評分 RPC、storage bucket）。
3. **Authentication → Providers → Email**：啟用 Email 登入。開發時可在 **Authentication → Sign In / Up** 關閉 "Confirm email" 以便快速測試（正式上線再開啟）。
4. **Authentication → URL Configuration → Redirect URLs** 加入：
   - `http://localhost:3000/auth/callback`
   - `https://<你的正式網域>/auth/callback`

### 3. 環境變數
```bash
cp .env.local.example .env.local
```
填入：
| 變數 | 來源 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上 → anon / public key |
| `NEXT_PUBLIC_SITE_URL` | 開發用 `http://localhost:3000` |
| `PARSE_PROVIDER` | 解析來源：`gemini`（預設，有 `GOOGLE_API_KEY` 時）或 `anthropic` |
| `GOOGLE_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey)（Gemini 拍照建題，建議；僅伺服器端） |
| `GEMINI_PARSE_MODEL` | 可留空，預設 `gemini-2.5-flash` |
| `ANTHROPIC_API_KEY` | （備援）[console.anthropic.com](https://console.anthropic.com)，僅伺服器端 |
| `ANTHROPIC_PARSE_MODEL` | 可留空，預設 `claude-sonnet-4-6` |

### 4. 啟動
```bash
npm run dev
# http://localhost:3000
```

### 5. 成為出題者／管理員
1. 先用 `http://localhost:3000/register` 註冊一個帳號並登入。
2. Supabase → **Table Editor → `profiles`** → 找到你的 row → 把 `role` 改成 `provider` 或 `admin`。
3. 重新整理，右上角選單就會出現「出題後台」，即可使用「拍照建題」。

---

## 部署到 Vercel

1. 推到 GitHub，於 Vercel 匯入專案。
2. 在 Vercel → Settings → Environment Variables 設定上表所有變數（`NEXT_PUBLIC_SITE_URL` 改成正式網域）。
3. 把正式網域的 `/auth/callback` 加進 Supabase 的 Redirect URLs。

---

## 專案結構

```
app/
  layout.tsx                  # 字體、SessionProvider、Header/Footer
  page.tsx                    # 首頁
  login/ register/            # 帳號（信箱＋密碼）
  auth/callback/route.ts      # email 驗證 code exchange
  exams/                      # 題庫列表
    [id]/                     # 考卷詳情 + 守則
    [id]/take/                # 考試作答 + 全螢幕鎖定（exam-runner）
  history/                    # 答題記錄列表
    [attemptId]/              # 成績檢討（ResultView）
  admin/                      # 後台（限 provider/admin）
    upload/                   # 拍照建題精靈
    exams/                    # 我的考卷管理
  api/parse-exam/route.ts     # Claude 視覺解析（strict tool 結構化輸出）
components/
  ui/                         # shadcn 風格元件
  layout/ auth/ exam/ admin/  # 版面、登入狀態、考試、後台元件
lib/
  supabase/                   # client / server / proxy / 型別
  constants.ts types.ts exam.ts utils.ts
proxy.ts                      # Next 16 proxy（= 舊 middleware），刷新 session
supabase/schema.sql           # 資料庫 + RLS + 評分 RPC + storage
```

---

## 已知後續可加強
- 編輯「既有」考卷的題目（目前可重新建立 / 刪除；建立流程已完整）
- AI 解析可加上 web search grounding（需與結構化輸出分兩階段，因 citations 與 strict 輸出不相容）
- 填空題的手寫辨識（目前先做同音字選項）

© kerchi
