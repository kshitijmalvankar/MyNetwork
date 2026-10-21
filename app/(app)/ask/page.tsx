import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { AskWorkspace } from "@/components/ask/ask-workspace";
import { requireUser } from "@/lib/auth/dal";
import { loadAskSidebar } from "./load";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage() {
  const user = await requireUser();
  const sidebar = await loadAskSidebar(user.id);
  const threadId = randomUUID();
  return <AskWorkspace key={threadId} threadId={threadId} initialMessages={[]} isNew {...sidebar} />;
}
