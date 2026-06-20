"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/auth/session-provider";
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

type Status = "idle" | "sending" | "sent" | "error" | "invalid" | "unconfirmed";

export function LoginForm() {
  const search = useSearchParams();
  const router = useRouter();
  const { user } = useSession();
  const redirect = sanitizeRedirect(search.get("redirect"));

  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (user && redirect !== "/login") router.replace(redirect);
  }, [user, redirect, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    const supabase = createClient();
    setStatus("sending");

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (!error) {
        router.replace(redirect);
        router.refresh();
        return;
      }
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid") || msg.includes("credentials")) setStatus("invalid");
      else if (msg.includes("confirm")) setStatus("unconfirmed");
      else setStatus("error");
      return;
    }

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(redirect)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
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
          disabled={status === "sending"}
        />
      </div>

      {mode === "password" && (
        <div className="space-y-2">
          <Label htmlFor="password">密碼</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={status === "sending"}
          />
        </div>
      )}

      <Button type="submit" disabled={status === "sending"} className="w-full">
        {status === "sending" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : mode === "password" ? (
          <LogIn className="size-4" />
        ) : (
          <Mail className="size-4" />
        )}
        {status === "sending" ? "處理中…" : mode === "password" ? "登入" : "寄送登入連結"}
      </Button>

      {status === "sent" && <p className="text-sm text-primary">登入連結已寄到你的信箱，點開即可登入。</p>}
      {status === "invalid" && <p className="text-sm text-destructive">信箱或密碼錯誤。</p>}
      {status === "unconfirmed" && (
        <p className="text-sm text-destructive">此信箱尚未完成驗證，請先到信箱點開驗證信。</p>
      )}
      {status === "error" && <p className="text-sm text-destructive">發生錯誤，請稍後再試。</p>}

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "password" ? "magic" : "password"));
          setStatus("idle");
        }}
        className="w-full text-xs text-muted-foreground underline underline-offset-4 hover:text-primary"
      >
        {mode === "password" ? "改用 Email 登入連結（免密碼）" : "改用密碼登入"}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        還沒有帳號？{" "}
        <Link
          href={`/register?redirect=${encodeURIComponent(redirect)}`}
          className="font-medium text-primary hover:underline"
        >
          註冊
        </Link>
      </p>
    </form>
  );
}
