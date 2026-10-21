import { after, type NextRequest } from "next/server";
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
  pruneMessages,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { askInstructions, createAskTools, type AskContext, type AskUIMessage } from "@/lib/ai/ask";
import { chatModel, costOf } from "@/lib/ai/client";
import { guardAiRequest, textError } from "@/lib/ai/guard";
import { recordUsage, releaseQuota } from "@/lib/ai/metering";
import { models } from "@/lib/ai/models";
import { MAX_QUESTION_CHARS } from "@/lib/ask/limits";
import { ensureThread, loadThread, saveMessages } from "@/lib/ask/threads";
import { getAuthorizedUser, getProfile } from "@/lib/auth/dal";
import { todayIn } from "@/lib/dates";
import { indexStale } from "@/lib/knowledge/indexer";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// Only the newest message comes from the browser; history is loaded from the
// database, so a client can't rewrite earlier turns or inject tool results.
const bodySchema = z.object({
  id: z.uuid(),
  message: z.object({
    id: z.string().min(1).max(64),
    role: z.literal("user"),
    parts: z.array(z.object({ type: z.literal("text"), text: z.string() })).min(1).max(4),
  }),
});

export async function POST(request: NextRequest) {
  const user = await getAuthorizedUser();
  if (!user) return textError(401, "Please sign in again.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return textError(400, "That message couldn't be sent.");
  const { id: threadId, message } = parsed.data;
  const text = message.parts.map((p) => p.text).join("\n").trim();
  if (!text) return textError(400, "Type a question first.");
  if (text.length > MAX_QUESTION_CHARS) return textError(400, `Keep questions under ${MAX_QUESTION_CHARS} characters.`);

  const blocked = await guardAiRequest(user.id, "ask", "ask", "questions");
  if (blocked) return blocked;

  const supabase = await createClient();
  const history = await loadThread(supabase, user.id, threadId);
  if (history === null && !(await ensureThread(supabase, user.id, threadId, text))) {
    await releaseQuota(user.id, "ask");
    return textError(404, "This conversation no longer exists.");
  }

  const userMessage: AskUIMessage = { id: message.id, role: "user", parts: [{ type: "text", text }] };
  const ctx: AskContext = { supabase, userId: user.id, usage: [] };
  const tools = createAskTools(ctx);

  // Keep the last few turns. Earlier tool calls are dropped; the answers keep their links.
  const recent = [...(history ?? []).filter((m) => m.id !== message.id).slice(-12), userMessage];
  while (recent[0].role !== "user") recent.shift(); // a conversation must start with the user
  const validated = await safeValidateUIMessages<AskUIMessage>({ messages: recent, tools });
  const messages = validated.success ? validated.data : [userMessage];
  const modelMessages = pruneMessages({ messages: await convertToModelMessages(messages, { tools }), toolCalls: "all", reasoning: "all" });

  const profile = await getProfile(user.id);
  const timeZone = profile?.timezone ?? "UTC";
  const started = Date.now();
  let released = false;

  const result = streamText({
    // Reasoning off: same eval accuracy, about a third faster and cheaper.
    model: chatModel(models.chat, { reasoning: "none" }),
    instructions: askInstructions({ name: profile?.display_name, today: todayIn(timeZone), timeZone }),
    messages: modelMessages,
    tools,
    stopWhen: isStepCount(6),
    maxOutputTokens: 1500,
    onEnd: async ({ steps, totalUsage }) => {
      await recordUsage(user.id, [
        {
          feature: "ask",
          model: models.chat,
          inputTokens: totalUsage.inputTokens ?? 0,
          outputTokens: totalUsage.outputTokens ?? 0,
          costUsd: steps.reduce((sum, s) => sum + costOf(s), 0),
          latencyMs: Date.now() - started,
        },
        ...ctx.usage,
      ]);
    },
    onError: async ({ error }) => {
      console.error("[ask] generation failed", error instanceof Error ? error.message : error);
      if (!released) {
        released = true;
        await releaseQuota(user.id, "ask");
      }
    },
  });

  // Finish (and save) even if the browser disconnects mid-answer.
  result.consumeStream();
  // Catch up on anything not yet searchable, for the next question.
  after(() => indexStale({ userId: user.id, limit: 25 }));

  return createUIMessageStreamResponse({
    stream: toUIMessageStream<typeof tools, AskUIMessage>({
      stream: result.stream,
      tools,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      sendReasoning: false,
      onEnd: async ({ responseMessage, isAborted }) => {
        const toSave = [userMessage];
        if (responseMessage.parts.length > 0) toSave.push(responseMessage);
        try {
          await saveMessages(supabase, user.id, threadId, toSave);
        } catch (err) {
          console.error("[ask] failed to save messages", err instanceof Error ? err.message : err, { isAborted });
        }
      },
      onError: () => "Something went wrong while answering. Please try again.",
    }),
  });
}
