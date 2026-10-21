import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AskWorkspace } from "@/components/ask/ask-workspace";
import { loadThread } from "@/lib/ask/threads";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { loadAskSidebar } from "../load";

export const metadata: Metadata = { title: "Ask" };

export default async function AskThreadPage({ params }: PageProps<"/ask/[threadId]">) {
  const user = await requireUser();
  const { threadId } = await params;
  if (!z.uuid().safeParse(threadId).success) notFound();
  const supabase = await createClient();
  const [messages, sidebar] = await Promise.all([loadThread(supabase, user.id, threadId), loadAskSidebar(user.id)]);
  if (messages === null) notFound();
  return <AskWorkspace key={threadId} threadId={threadId} initialMessages={messages} {...sidebar} />;
}
