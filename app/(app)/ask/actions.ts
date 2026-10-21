"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function deleteThread(threadId: string): Promise<{ ok: boolean }> {
  await requireUser();
  if (!z.uuid().safeParse(threadId).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("chat_threads").delete().eq("id", threadId);
  return { ok: !error };
}
