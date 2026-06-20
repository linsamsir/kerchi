"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function sanitizeRedirect(raw: string | null): string {
  if (!raw) return "/";
  try {
    const d = decodeURIComponent(raw);
    if (d.startsWith("/") && !d.startsWith("//")) return d;
  } catch {}
  return "/";
}

export function RegisterForm() {
  const search = useSearchParams();
  const redirect = sanitizeRedirect(search.get("redirect"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"confirm" | "ready" | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("密碼至少需要 6 個字。");
      return;
    }
    if (password !== confirm) {
      setError("兩次輸入的密碼不一致。");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(redirect)}`;

    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo },
    });
    setSubmitting(false);

    if (err) {
      const msg = err.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) setError("這個信箱已經註冊過了。");
      else setError(`註冊失敗：${err.message}`);
      return;
    }

    // 若專案設定需要 email 驗證，session 會是 null；否則直接可用。
    setDone(data.session ? "ready" : "confirm");
  }

  if (done) {
    return (
      <div className="space-y-4">
        {done === "confirm" ? (
          <p className="text-sm">
            註冊成功！我們寄了一封驗證信到 <span className="font-semibold">{email}</span>
            ，請點開信中的連結完成驗證後再登入。
          </p>
        ) : (
          <p className="text-sm text-primary">註冊成功，可以登入了！</p>
        )}
        <Link
          href={`/login?redirect=${encodeURIComponent(redirect)}`}
          className="inline-flex h-10 items-center rounded-[var(--radius)] bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-[#4338ca]"
        >
          前往登入
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">電子信箱</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">密碼</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />
        <p className="text-xs text-muted-foreground">至少 6 個字。</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">再次輸入密碼</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          minLength={6}
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={submitting}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
        {submitting ? "註冊中…" : "註冊"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        已經有帳號了？{" "}
        <Link
          href={`/login?redirect=${encodeURIComponent(redirect)}`}
          className="font-medium text-primary hover:underline"
        >
          登入
        </Link>
      </p>
    </form>
  );
}
