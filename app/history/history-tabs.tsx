"use client";

import { AttemptRow } from "@/components/exam/attempt-row";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Attempt, Exam } from "@/lib/types";

type Row = Attempt & {
  exams: Exam | null;
  profiles?: { display_name: string | null } | null;
};

export function HistoryTabs({
  mine,
  all,
  loggedIn,
}: {
  mine: Row[];
  all: Row[];
  loggedIn: boolean;
}) {
  return (
    <Tabs defaultValue={loggedIn ? "mine" : "all"}>
      <TabsList>
        <TabsTrigger value="mine">我的記錄</TabsTrigger>
        <TabsTrigger value="all">所有記錄</TabsTrigger>
      </TabsList>

      <TabsContent value="mine">
        {!loggedIn ? (
          <p className="kerchi-card p-6 text-center text-sm text-muted-foreground">登入後即可看到自己的答題記錄。</p>
        ) : mine.length === 0 ? (
          <p className="kerchi-card p-6 text-center text-sm text-muted-foreground">還沒有作答記錄，去題庫挑一份考卷吧！</p>
        ) : (
          <div className="kerchi-card divide-y divide-border">
            {mine.map((a) => (
              <AttemptRow key={a.id} attempt={a} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="all">
        {all.length === 0 ? (
          <p className="kerchi-card p-6 text-center text-sm text-muted-foreground">目前還沒有任何答題記錄。</p>
        ) : (
          <div className="kerchi-card divide-y divide-border">
            {all.map((a) => (
              <AttemptRow key={a.id} attempt={a} showName />
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
