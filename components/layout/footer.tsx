"use client";

import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  if (pathname?.includes("/take")) return null;

  return (
    <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
      <p>kerchi · 線上模擬考 — 考試的台語諧音</p>
    </footer>
  );
}
