import { Suspense } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "登入" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-12">
      <Link href="/" className="mb-6 flex items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <GraduationCap className="size-5" />
        </span>
        <span className="text-2xl font-extrabold tracking-tight">kerchi</span>
      </Link>
      <div className="w-full kerchi-card p-6">
        <h1 className="mb-1 text-xl font-bold">登入</h1>
        <p className="mb-5 text-sm text-muted-foreground">登入後就能開始模擬考。</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
