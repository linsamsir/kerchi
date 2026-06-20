import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, ShieldX, Upload, BookOpen } from "lucide-react";
import { getSessionUser, getProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirect=/admin");

  const profile = await getProfile();
  const allowed = profile?.role === "provider" || profile?.role === "admin";

  if (!allowed) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-[#fee2e2] text-destructive">
          <ShieldX className="size-6" />
        </span>
        <h1 className="text-xl font-bold">需要出題權限</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          這個區域只開放給出題者或管理員。請到 Supabase 的 <code>profiles</code> 資料表，
          把你帳號的 <code>role</code> 改成 <code>provider</code> 或 <code>admin</code>，再重新整理。
        </p>
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          返回首頁
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="mr-4 flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <LayoutDashboard className="size-5 text-primary" /> 出題後台
        </h1>
        <NavLink href="/admin/upload" icon={<Upload className="size-4" />}>拍照建題</NavLink>
        <NavLink href="/admin/exams" icon={<BookOpen className="size-4" />}>我的考卷</NavLink>
      </div>
      {children}
    </div>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {icon} {children}
    </Link>
  );
}
