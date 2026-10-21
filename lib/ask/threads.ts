import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AskUIMessage } from "@/lib/ai/ask";
import { threadTitle, type ThreadSummary } from "@/lib/ask/title";
import { openField, openJson, sealField, sealJson } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { fromBytea, toBytea } from "@/lib/supabase/bytea";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;


const titleField = (userId: string, threadId: string) => ({ userId, table: "chat_threads", column: "title_enc", rowId: threadId });
const partsField = (userId: string, rowId: string) => ({ userId, table: "chat_messages", column: "parts_enc", rowId });

export async function listThreads(supabase: Supabase, userId: string, limit = 30): Promise<ThreadSummary[]> {
  const { data } = await supabase.from("chat_threads").select("id, title_enc, updated_at").order("updated_at", { ascending: false }).limit(limit);
  if (!data?.length) return [];
  const dek = await getUserDataKey(userId);
  return data.map((t) => ({
    id: t.id,
    title: t.title_enc ? openField(dek, fromBytea(t.title_enc), titleField(userId, t.id)).toString("utf8") : "Untitled",
    updatedAt: t.updated_at,
  }));
}

/** The most recent messages of a thread, oldest first. Null if the thread isn't the user's. */
export async function loadThread(supabase: Supabase, userId: string, threadId: string, limit = 40) {
  const { data: thread } = await supabase.from("chat_threads").select("id").eq("id", threadId).maybeSingle();
  if (!thread) return null;
  const { data } = await supabase
    .from("chat_messages")
    .select("id, message_id, role, parts_enc")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data?.length) return [];
  const dek = await getUserDataKey(userId);
  return data.reverse().map(
    (m) =>
      ({
        id: m.message_id,
        role: m.role as AskUIMessage["role"],
        parts: openJson<AskUIMessage["parts"]>(dek, fromBytea(m.parts_enc), partsField(userId, m.id)),
      }) satisfies AskUIMessage,
  );
}

/** Creates the thread on its first message. Returns false if the id belongs to someone else. */
export async function ensureThread(supabase: Supabase, userId: string, threadId: string, firstMessage: string): Promise<boolean> {
  const { data: existing } = await supabase.from("chat_threads").select("id").eq("id", threadId).maybeSingle();
  if (existing) return true;
  const dek = await getUserDataKey(userId);
  const { error } = await supabase.from("chat_threads").insert({
    id: threadId,
    user_id: userId,
    title_enc: toBytea(sealField(dek, threadTitle(firstMessage), titleField(userId, threadId))),
  });
  return !error;
}

/** Saves messages that aren't stored yet (by message id) and bumps the thread. */
export async function saveMessages(supabase: Supabase, userId: string, threadId: string, messages: AskUIMessage[]) {
  if (messages.length === 0) return;
  const dek = await getUserDataKey(userId);
  // Rows saved together would otherwise share a timestamp and could load out of order.
  const base = Date.now();
  const rows = messages.map((m, i) => {
    const id = randomUUID();
    return {
      id,
      user_id: userId,
      thread_id: threadId,
      message_id: m.id,
      role: m.role,
      parts_enc: toBytea(sealJson(dek, m.parts, partsField(userId, id))),
      created_at: new Date(base + i).toISOString(),
    };
  });
  const { error } = await supabase.from("chat_messages").upsert(rows, { onConflict: "thread_id,message_id", ignoreDuplicates: true });
  if (error) throw error;
  await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
}
