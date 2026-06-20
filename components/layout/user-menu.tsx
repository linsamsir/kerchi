"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { History, LayoutDashboard, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/components/auth/session-provider";

export function UserMenu() {
  const { user, profile, loading, isProvider, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (loading) {
    return <span aria-hidden className="inline-block size-9 rounded-full bg-muted" />;
  }

  if (!user) {
    const redirect = encodeURIComponent(pathname || "/");
    return (
      <Link
        href={`/login?redirect=${redirect}`}
        className="inline-flex h-9 items-center rounded-[var(--radius)] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-[#4338ca]"
      >
        登入
      </Link>
    );
  }

  const name = profile?.display_name || user.email || "我";
  const initial = name[0]?.toUpperCase() || "·";

  function onSignOut() {
    start(async () => {
      await signOut();
      setOpen(false);
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-3 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="帳號選單"
      >
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {initial}
        </span>
        <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline">{name}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <div className="px-3 py-2">
          <div className="truncate text-sm font-semibold">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
          {profile?.role && profile.role !== "student" && (
            <div className="mt-1 inline-flex rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
              {profile.role === "admin" ? "管理員" : "出題者"}
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/history">
            <History className="size-4" /> 我的記錄
          </Link>
        </DropdownMenuItem>
        {isProvider && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard className="size-4" /> 出題後台
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onSignOut();
          }}
          disabled={pending}
          className="text-destructive"
        >
          <LogOut className="size-4" /> {pending ? "登出中…" : "登出"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
