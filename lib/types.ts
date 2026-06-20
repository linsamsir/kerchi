// Shared domain types for kerchi.

export type Stage =
  | "kindergarten"
  | "elementary"
  | "junior_high"
  | "senior_high"
  | "university"
  | "society";

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "true_false"
  | "fill_blank" // 同音字選項
  | "fill_text"; // 直接書寫（國字/注音/數值），正規化比對

export type Role = "student" | "provider" | "admin";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: Role;
  created_at: string;
}

export interface QuestionOption {
  key: string; // "A" / "B" / "true" / "false" ...
  text: string;
}

/** A question as stored (includes answer/explanation — admin/owner only). */
export interface Question {
  id: string;
  exam_id: string;
  order_index: number;
  type: QuestionType;
  stem: string;
  passage: string | null;
  image_url: string | null;
  options: QuestionOption[];
  answer: string[]; // 選擇題=正確 key；fill_text=可接受答案字串
  explanation: string | null;
  chapter: string | null;
  skill_tags: string[];
  points: number;
}

/** A question shown to a student while taking the exam (answer stripped). */
export interface PublicQuestion {
  id: string;
  order_index: number;
  type: QuestionType;
  stem: string;
  passage: string | null;
  image_url: string | null;
  options: QuestionOption[];
  chapter: string | null;
  points: number;
}

export interface Exam {
  id: string;
  title: string;
  stage: Stage;
  grade: string | null;
  semester: number | null;
  subject: string;
  description: string | null;
  source_images: string[];
  proctor_password: string | null;
  time_limit_minutes: number | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  question_count?: number;
}

export type AttemptStatus = "in_progress" | "submitted" | "abandoned";

export interface ChapterStat {
  correct: number;
  total: number;
}

export interface Attempt {
  id: string;
  exam_id: string;
  user_id: string;
  started_at: string;
  submitted_at: string | null;
  duration_seconds: number | null;
  earned_points: number | null;
  total_points: number | null;
  correct_count: number | null;
  question_count: number | null;
  score: number | null; // percentage 0–100
  status: AttemptStatus;
  per_chapter: Record<string, ChapterStat> | null;
  violations_count: number;
  // joined
  exam?: Pick<Exam, "title" | "subject" | "stage" | "semester" | "grade">;
  display_name?: string | null;
}

export interface AttemptAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  user_answer: string[];
  is_correct: boolean;
  time_spent_seconds: number;
}

/** One row returned by get_attempt_review() — full per-question review. */
export interface ReviewItem {
  question_id: string;
  order_index: number;
  type: QuestionType;
  stem: string;
  passage: string | null;
  options: QuestionOption[];
  chapter: string | null;
  points: number;
  explanation: string | null;
  correct_answer: string[];
  user_answer: string[];
  is_correct: boolean;
  time_spent_seconds: number;
}

/** Shape the AI parser returns for one question (pre-save). */
export interface ParsedQuestion {
  type: QuestionType;
  stem: string;
  passage: string;
  options: QuestionOption[];
  answer: string[];
  explanation: string;
  chapter: string;
  skill_tags: string[];
  points: number;
}

export interface ParsedExam {
  title: string;
  subject: string;
  questions: ParsedQuestion[];
}
