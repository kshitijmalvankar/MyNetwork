import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { AskWorkspace } from "@/components/ask/ask-workspace";
import { MAX_QUESTION_CHARS } from "@/lib/ask/limits";
import { requireUser } from "@/lib/auth/dal";
import { loadAskSidebar } from "./load";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage({ searchParams }: PageProps<"/ask">) {
  const user = await requireUser();
  const sidebar = await loadAskSidebar(user.id);
  const { q } = await searchParams;
  const threadId = randomUUID();
  return (
    <AskWorkspace
      key={threadId}
      threadId={threadId}
      initialMessages={[]}
      isNew
      initialQuestion={typeof q === "string" ? q.slice(0, MAX_QUESTION_CHARS) : undefined}
      {...sidebar}
    />
  );
}
