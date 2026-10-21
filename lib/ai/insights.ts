import "server-only";
import { createHmac } from "node:crypto";
import { generateText, Output } from "ai";
import { z } from "zod";
import { chatModel, costOf } from "@/lib/ai/client";
import type { UsageEntry } from "@/lib/ai/metering";
import { models } from "@/lib/ai/models";
import { blindIndexKey, deriveKey } from "@/lib/crypto/keys";

/** What `network_insights()` returns. */
export type NetworkStats = {
  totals: {
    people: number;
    companies: number;
    events: number;
    notes: number;
    voiceNotes: number;
    addedThisMonth: number;
    addedLastMonth: number;
    touchesThisMonth: number;
    touchesLastMonth: number;
  };
  growth: { month: string; people: number }[];
  roles: { value: string; count: number }[];
  industries: { value: string; count: number }[];
  countries: { value: string; count: number }[];
  cities: { value: string; count: number }[];
  seniority: { value: string; count: number }[];
  companies: { id: string; name: string; count: number }[];
  events: { id: string; name: string; date: string | null; count: number }[];
  lastTouch: { bucket: string; count: number }[];
  followUps: { open: number; overdue: number; doneThisMonth: number };
};

/** Below this, there isn't enough to say anything useful. */
export const MIN_PEOPLE_FOR_SUMMARY = 5;
const PROMPT_VERSION = 2;

// Actions are picked from a fixed list; the app turns them into links, so the model never writes a URL.
export const ACTION_KINDS = ["reconnect", "follow_ups", "scan", "graph", "ask"] as const;

export const summarySchema = z.object({
  headline: z.string().describe("One sentence about the network right now"),
  observations: z.array(z.string()).min(2).max(4).describe("Specific observations, each with a number"),
  actions: z
    .array(
      z.object({
        kind: z.enum(ACTION_KINDS),
        label: z.string().describe("Button text, at most 6 words"),
        question: z.string().nullable().describe("For kind 'ask' only: a question to ask about the network; otherwise null"),
      }),
    )
    .max(3),
});
export type InsightSummary = z.infer<typeof summarySchema>;

/** Only aggregates and company/event names go to the model; no person's name or details. */
export function statsForModel(s: NetworkStats) {
  const top = (rows: { value: string; count: number }[], n = 5) => rows.slice(0, n).map((r) => `${r.value}: ${r.count}`).join(", ");
  // Totals the summary is likely to want, worked out here so the model never has to do arithmetic.
  const lastThreeMonths = s.growth.slice(-3).reduce((sum, g) => sum + g.people, 0);
  const inTouch = (s.lastTouch[0]?.count ?? 0) + (s.lastTouch[1]?.count ?? 0);
  const pct = (n: number) => (s.totals.people ? Math.round((n / s.totals.people) * 100) : 0);
  return [
    `People: ${s.totals.people} at ${s.totals.companies} companies, met across ${s.totals.events} events.`,
    `Added this month: ${s.totals.addedThisMonth} (last month: ${s.totals.addedLastMonth}). Added in the last 3 months: ${lastThreeMonths}.`,
    `In touch within the last 3 months: ${inTouch} of ${s.totals.people} (${pct(inTouch)}%). Not in touch for over 3 months: ${s.totals.people - inTouch} (${pct(s.totals.people - inTouch)}%).`,
    `Meetings, calls and messages logged this month: ${s.totals.touchesThisMonth} (last month: ${s.totals.touchesLastMonth}).`,
    `Notes: ${s.totals.notes}, of which voice notes: ${s.totals.voiceNotes}.`,
    `People added per month (oldest first): ${s.growth.map((g) => `${g.month}: ${g.people}`).join(", ")}.`,
    `Roles: ${top(s.roles)}.`,
    `Industries: ${top(s.industries)}.`,
    `Seniority: ${s.seniority.filter((x) => x.count > 0).map((x) => `${x.value}: ${x.count}`).join(", ")}.`,
    `Countries: ${top(s.countries)}. Cities: ${top(s.cities)}.`,
    `Biggest companies: ${s.companies.slice(0, 5).map((c) => `${c.name}: ${c.count}`).join(", ") || "none"}.`,
    `Biggest events: ${s.events.slice(0, 5).map((e) => `${e.name}${e.date ? ` (${e.date})` : ""}: ${e.count} people`).join(", ") || "none"}.`,
    `Time since last contact: ${s.lastTouch.map((b) => `${b.bucket}: ${b.count}`).join(", ")}.`,
    `Follow-ups: ${s.followUps.open} open, ${s.followUps.overdue} overdue, ${s.followUps.doneThisMonth} done this month.`,
  ].join("\n");
}

export function summaryInstructions({ name, today }: { name?: string | null; today: string }) {
  return `You write the short summary at the top of the Insights page for ${name || "the user"}, who keeps track of people they meet at networking events. Today is ${today}.

- headline: one friendly sentence about where their network stands.
- observations: two to four specific points, each under 25 words and each with a number from the stats (for example "Engineering is your biggest group: 7 of 32 people"). Each point covers one topic and uses only that topic's numbers: growth (people added), who they are (roles, industries, seniority, places, companies), events, or keeping in touch (time since last contact, follow-ups). Include at least one thing worth acting on, such as people not contacted in over 3 months or overdue follow-ups.
- actions: up to three buttons. kind "reconnect" (see who to get back in touch with), "follow_ups" (open follow-ups), "scan" (add cards), "graph" (explore the network map) or "ask" (with a question the user could ask about their network, e.g. "Who from TechSummit Mumbai 2026 haven't I contacted since?").
- Use only the numbers and names in <stats>, quoted exactly as given. Never add, subtract or otherwise work out a new number. Don't invent people, events or trends, and don't connect two numbers unless the stats connect them (for example, don't say which event this month's new people came from).
- Address the user as "you". Plain, warm language; no exclamation marks.`;
}

export async function writeSummary(stats: NetworkStats, ctx: { name?: string | null; today: string }) {
  const started = Date.now();
  const result = await generateText({
    model: chatModel(models.chat, { reasoning: "none" }),
    instructions: summaryInstructions(ctx),
    prompt: `<stats>\n${statsForModel(stats)}\n</stats>`,
    output: Output.object({ schema: summarySchema }),
    maxOutputTokens: 700,
  });
  const usage: UsageEntry = {
    feature: "brief",
    model: models.chat,
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    costUsd: costOf(result),
    latencyMs: Date.now() - started,
  };
  return { summary: result.output, usage };
}

let hashKey: Buffer | undefined;

/** Changes when the numbers change, so the page can say a summary is out of date. */
export function statsHash(userId: string, stats: NetworkStats) {
  hashKey ??= deriveKey(blindIndexKey(), "insights");
  return createHmac("sha256", hashKey).update(JSON.stringify([userId, PROMPT_VERSION, models.chat, statsForModel(stats)])).digest("base64url");
}
