// Live eval for meeting briefs and follow-up drafts, against the fictional
// network loaded by `pnpm seed:network`. Costs about a cent.
//   pnpm eval brief
//   EVAL_CHAT_MODELS=a/b pnpm eval brief
import { mkdirSync, writeFileSync } from "node:fs";
import { generateText } from "ai";
import { describe, expect, it } from "vitest";
import {
  briefInstructions,
  briefPrompt,
  draftInstructions,
  draftPrompt,
  loadPersonContext,
  personContextText,
  type DraftRequest,
} from "@/lib/ai/brief";
import { chatModel, costOf } from "@/lib/ai/client";
import { models } from "@/lib/ai/models";
import { signInTestUser } from "./session";

const CANDIDATES = (process.env.EVAL_CHAT_MODELS ?? models.chat).split(",");
const TODAY = "2026-10-21";
const SENDER = "Test User";

type BriefCase = { kind: "brief"; person: string; purpose?: string; mustInclude: string[]; maxWords: number };
type DraftCase = { kind: "draft"; person: string; request: DraftRequest; mustInclude: string[]; mustNotInclude?: string[]; maxWords: number };
type Case = BriefCase | DraftCase;

const CASES: Case[] = [
  { kind: "brief", person: "Priya Shah", mustInclude: ["warehouse", "TechSummit"], maxWords: 260 },
  { kind: "brief", person: "Arjun Mehta", mustInclude: ["pricing deck", "30 Oct"], maxWords: 260 },
  { kind: "brief", person: "Mei Lin", mustInclude: ["TechSummit"], maxWords: 170 },
  { kind: "brief", person: "Tom Becker", purpose: "Talking about his Series A fundraising", mustInclude: ["Series A", "Lucas"], maxWords: 260 },
  {
    kind: "draft",
    person: "Tom Becker",
    request: { channel: "email", tone: "warm", intent: "Offer to introduce him to Lucas Moreau at Kestrel Capital for his Series A" },
    mustInclude: ["Subject:", "Lucas"],
    // The call was in July; "last month" would be wrong.
    mustNotInclude: ["last month", "last week"],
    maxWords: 190,
  },
  { kind: "draft", person: "Priya Shah", request: { channel: "message", tone: "casual" }, mustInclude: [], maxWords: 90 },
  {
    kind: "draft",
    person: "Samuel Adeyemi",
    request: { channel: "email", tone: "professional", intent: "Check in now that their budget planning is done" },
    mustInclude: ["Subject:", "budget"],
    maxWords: 190,
  },
  {
    kind: "draft",
    person: "Mei Lin",
    request: { channel: "message", tone: "warm", intent: "Ask if she'd like to grab coffee in Singapore next month" },
    mustInclude: ["coffee"],
    maxWords: 90,
  },
];

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe("briefs and drafts", () => {
  it("stick to the facts and the requested format", { timeout: 600_000 }, async () => {
    const { supabase, userId } = await signInTestUser();
    const { data: people } = await supabase.from("contacts").select("id, full_name");
    const idOf = new Map((people ?? []).map((p) => [p.full_name, p.id]));
    expect(idOf.size).toBeGreaterThan(0);

    const report = [];
    for (const model of CANDIDATES) {
      const results = await Promise.all(
        CASES.map(async (c) => {
          const person = await loadPersonContext(supabase, userId, idOf.get(c.person)!);
          const context = personContextText(person!);
          const allowedIds = new Set([person!.contact.id, ...person!.related.map((r) => r.id)]);
          const started = Date.now();
          const r = await generateText({
            model: chatModel(model, { reasoning: "none" }),
            ...(c.kind === "brief"
              ? { instructions: briefInstructions({ name: SENDER, today: TODAY }), prompt: briefPrompt(context, c.purpose ?? "") }
              : { instructions: draftInstructions({ senderName: SENDER, request: c.request, today: TODAY }), prompt: draftPrompt(context, c.request) }),
            maxOutputTokens: 800,
          });
          const text = r.text.trim();
          const problems: string[] = [];
          for (const m of c.mustInclude) if (!text.toLowerCase().includes(m.toLowerCase())) problems.push(`missing "${m}"`);
          if (words(text) > c.maxWords) problems.push(`${words(text)} words`);
          for (const [, id] of text.matchAll(/\(contact:([0-9a-f-]{36})\)/g)) if (!allowedIds.has(id)) problems.push(`unknown link ${id}`);
          if (/\[(your|company|name|date)[^\]]*\]/i.test(text)) problems.push("placeholder");
          if (c.kind === "draft") {
            for (const m of c.mustNotInclude ?? []) if (text.toLowerCase().includes(m)) problems.push(`says "${m}"`);
            const hasSubject = /^subject:/i.test(text);
            if (c.request.channel === "email" && !hasSubject) problems.push("no subject line");
            if (c.request.channel === "message" && hasSubject) problems.push("subject in a message");
            if (c.request.channel === "email" && !/\bTest\s*$/.test(text)) problems.push("no sign-off");
          }
          return {
            case: `${c.kind}: ${c.person}${c.kind === "draft" ? ` (${c.request.channel})` : ""}`,
            ok: problems.length === 0,
            problems,
            words: words(text),
            costUsd: costOf(r),
            latencyMs: Date.now() - started,
            text,
          };
        }),
      );
      const passed = results.filter((r) => r.ok).length;
      const row = {
        model,
        passed: `${passed}/${CASES.length}`,
        avgCostUsd: Number((results.reduce((s, r) => s + r.costUsd, 0) / results.length).toFixed(5)),
        avgLatencyMs: Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length),
        results,
      };
      report.push(row);
      console.log(`${model}: ${row.passed}, $${row.avgCostUsd}/item, ${row.avgLatencyMs}ms avg`);
      for (const r of results.filter((x) => !x.ok)) console.log("  ✗", r.case, r.problems.join(", "));
    }

    mkdirSync("evals/results", { recursive: true });
    writeFileSync(`evals/results/brief-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(report, null, 2));
  });
});
