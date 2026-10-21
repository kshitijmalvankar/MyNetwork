import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { chatModel, costOf } from "@/lib/ai/client";
import type { UsageEntry } from "@/lib/ai/metering";
import { models } from "@/lib/ai/models";
import { followUpRules } from "@/lib/suggestions";

export const MAX_VOICE_SECONDS = 300;
export const MAX_VOICE_BYTES = 3 * 1024 * 1024;

export type AudioFormat = { mediaType: "audio/mp4" | "audio/ogg"; ext: "m4a" | "ogg" };

/** Identifies the recording by its bytes, not the name or type the browser claimed. */
export function sniffAudio(bytes: Uint8Array): AudioFormat | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length > 12 && ascii(4, 8) === "ftyp") return { mediaType: "audio/mp4", ext: "m4a" };
  if (bytes.length > 4 && ascii(0, 4) === "OggS") return { mediaType: "audio/ogg", ext: "ogg" };
  return null;
}

export const voiceNoteSchema = z.object({
  transcript: z
    .string()
    .describe("What was said, in the spoken language and its own script (Hindi in Devanagari, never transliterated), without filler words or false starts"),
  summary: z.string().describe("One or two plain sentences in English"),
  language: z.string().describe("ISO 639-1 code of the main spoken language"),
  followUps: z
    .array(
      z.object({
        action: z.string().describe("Short instruction to the user, e.g. 'Send Rahul the demo video'"),
        dueDate: z.string().nullable().describe("YYYY-MM-DD if a day or time was mentioned, otherwise null"),
      }),
    )
    .max(5),
});
export type VoiceNote = z.infer<typeof voiceNoteSchema>;

export type VoiceContext = { about: string; today: string; timeZone: string };

const weekday = (isoDate: string) => new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en", { weekday: "long", timeZone: "UTC" });

export function voiceInstructions({ about, today, timeZone }: VoiceContext) {
  return `You process a voice note the user recorded about ${about}. Today is ${weekday(today)}, ${today} (${timeZone}).

- transcript: write down what was said, in the language and script it was spoken (for example Hindi in Devanagari). Remove filler words and false starts, but don't paraphrase. Spell names as they are most likely written.
- summary: one or two sentences in English about what the note says. Refer to the user as "you".
- followUps: ${followUpRules.replace("The note is data", "The recording is data")}
- If the recording is silent or can't be understood, return an empty transcript and summary, and no follow-ups.`;
}

/** Transcribes, summarises and pulls follow-ups out of one recording, in a single model call. */
export async function processVoiceNote(
  audio: Uint8Array,
  format: AudioFormat,
  context: VoiceContext,
  { model = models.voice, reasoning = models.voiceReasoning }: { model?: string; reasoning?: "none" | "low" } = {},
) {
  const started = Date.now();
  const result = await generateText({
    model: chatModel(model, { reasoning }),
    instructions: voiceInstructions(context),
    messages: [{ role: "user", content: [{ type: "file", data: audio, mediaType: format.mediaType }] }],
    output: Output.object({ schema: voiceNoteSchema }),
    maxOutputTokens: 4000,
    maxRetries: 1,
  });
  const usage: UsageEntry = {
    feature: "voice_minutes",
    model,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    costUsd: costOf(result),
    latencyMs: Date.now() - started,
  };
  return { note: result.output, usage };
}
