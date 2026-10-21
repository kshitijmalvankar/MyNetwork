import type { NextRequest } from "next/server";
import { streamText } from "ai";
import { z } from "zod";
import { draftInstructions, draftPrompt, draftRequestSchema, loadPersonContext, personContextText } from "@/lib/ai/brief";
import { chatModel, costOf } from "@/lib/ai/client";
import { guardAiRequest, textError } from "@/lib/ai/guard";
import { recordUsage, releaseQuota } from "@/lib/ai/metering";
import { models } from "@/lib/ai/models";
import { getAuthorizedUser, getProfile } from "@/lib/auth/dal";
import { todayIn } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** A follow-up message for the user to edit and send themselves. Nothing is ever sent from here. */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/contacts/[id]/draft">) {
  const user = await getAuthorizedUser();
  if (!user) return textError(401, "Please sign in again.");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return textError(404, "Contact not found.");
  const parsed = draftRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return textError(400, "Keep the description under 500 characters.");

  const supabase = await createClient();
  const person = await loadPersonContext(supabase, user.id, id);
  if (!person) return textError(404, "Contact not found.");

  const blocked = await guardAiRequest(user.id, "brief", "assist", "briefs and drafts");
  if (blocked) return blocked;

  const profile = await getProfile(user.id);
  const started = Date.now();
  const result = streamText({
    model: chatModel(models.chat, { reasoning: "none" }),
    instructions: draftInstructions({ senderName: profile?.display_name, request: parsed.data, today: todayIn(profile?.timezone) }),
    prompt: draftPrompt(personContextText(person), parsed.data),
    maxOutputTokens: 600,
    onEnd: async ({ steps, totalUsage }) => {
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
    },
    onError: async ({ error }) => {
      console.error("[draft] generation failed", error instanceof Error ? error.message : error);
      await releaseQuota(user.id, "brief");
    },
  });

  return result.toTextStreamResponse({ headers: { "Cache-Control": "no-store" } });
}
