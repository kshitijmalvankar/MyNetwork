import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { streamText } from "ai";
import { z } from "zod";
import { briefInputHash, briefInstructions, briefPrompt, loadPersonContext, personContextText } from "@/lib/ai/brief";
import { chatModel, costOf } from "@/lib/ai/client";
import { guardAiRequest, textError } from "@/lib/ai/guard";
import { recordUsage, releaseQuota } from "@/lib/ai/metering";
import { models } from "@/lib/ai/models";
import { getAuthorizedUser, getProfile } from "@/lib/auth/dal";
import { openField, sealField } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { todayIn } from "@/lib/dates";
import { fromBytea, toBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const bodySchema = z.object({
  purpose: z.string().trim().max(300).optional().default(""),
  refresh: z.boolean().optional().default(false),
});

const cacheField = (userId: string, rowId: string) => ({ userId, table: "ai_cache", column: "payload_enc", rowId });

/**
 * A meeting brief for one contact, streamed as plain text. The same brief is
 * served from an encrypted cache (free) until anything it depends on changes
 * or the day rolls over.
 */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/contacts/[id]/brief">) {
  const user = await getAuthorizedUser();
  if (!user) return textError(401, "Please sign in again.");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return textError(404, "Contact not found.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return textError(400, "Keep the meeting description under 300 characters.");
  const { purpose, refresh } = parsed.data;

  const supabase = await createClient();
  const person = await loadPersonContext(supabase, user.id, id);
  if (!person) return textError(404, "Contact not found.");

  const profile = await getProfile(user.id);
  const today = todayIn(profile?.timezone);
  const context = personContextText(person);
  const hash = briefInputHash(user.id, context, purpose, today);

  if (!refresh) {
    const { data: cached } = await supabase
      .from("ai_cache")
      .select("id, input_hash, payload_enc, created_at")
      .eq("kind", "brief")
      .eq("contact_id", id)
      .maybeSingle();
    if (cached?.input_hash === hash) {
      const dek = await getUserDataKey(user.id);
      const text = openField(dek, fromBytea(cached.payload_enc), cacheField(user.id, cached.id)).toString("utf8");
      return new Response(text, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Brief-Cached-At": cached.created_at },
      });
    }
  }

  const blocked = await guardAiRequest(user.id, "brief", "assist", "briefs and drafts");
  if (blocked) return blocked;

  const started = Date.now();
  const result = streamText({
    model: chatModel(models.chat, { reasoning: "none" }),
    instructions: briefInstructions({ name: profile?.display_name, today }),
    prompt: briefPrompt(context, purpose),
    maxOutputTokens: 800,
    onEnd: async ({ text, steps, totalUsage, finishReason }) => {
      await recordUsage(user.id, [
        {
          feature: "brief",
          model: models.chat,
          inputTokens: totalUsage.inputTokens ?? 0,
          outputTokens: totalUsage.outputTokens ?? 0,
          costUsd: steps.reduce((sum, s) => sum + costOf(s), 0),
          latencyMs: Date.now() - started,
        },
      ]);
      if (finishReason !== "stop" || !text.trim()) return;
      const rowId = randomUUID();
      const dek = await getUserDataKey(user.id);
      const { error } = await supabase.from("ai_cache").upsert(
        {
          id: rowId,
          user_id: user.id,
          kind: "brief",
          contact_id: id,
          input_hash: hash,
          payload_enc: toBytea(sealField(dek, text, cacheField(user.id, rowId))),
          model: models.chat,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,kind,contact_id" },
      );
      if (error) console.error("[brief] failed to cache", error.message);
    },
    onError: async ({ error }) => {
      console.error("[brief] generation failed", error instanceof Error ? error.message : error);
      await releaseQuota(user.id, "brief");
    },
  });

  // Finish (and cache) even if the panel is closed mid-way.
  result.consumeStream();
  return result.toTextStreamResponse({ headers: { "Cache-Control": "no-store" } });
}
