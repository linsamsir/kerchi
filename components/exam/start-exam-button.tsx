"use client";

import Link from "next/link";
import { Play, LogIn } from "lucide-react";
import { useSession } from "@/components/auth/session-provider";
import { Button } from "@/components/ui/button";

export function StartExamButton({ examId }: { examId: string }) {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <Button size="lg" disabled>
        載入中…
      </Button>
    );
  }

  if (!user) {
    return (
      <Button asChild size="lg">
        <Link href={`/login?redirect=${encodeURIComponent(`/exams/${examId}/take`)}`}>
          <LogIn className="size-4" /> 登入後開始考試
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild size="lg">
      <Link href={`/exams/${examId}/take`}>
        <Play className="size-4" /> 開始考試
      </Link>
    </Button>
  );
}
