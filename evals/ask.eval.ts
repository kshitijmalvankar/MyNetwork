// Live "Ask my network" eval against the fictional network loaded by
// `pnpm seed:network` into the test account. Costs a few cents.
//   pnpm eval ask                      default chat model
//   EVAL_CHAT_MODELS=a/b,c/d pnpm eval ask
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generateText, isStepCount } from "ai";
import { describe, expect, it } from "vitest";
import { askInstructions, createAskTools, type AskContext } from "@/lib/ai/ask";
import { chatModel, costOf } from "@/lib/ai/client";
import { models } from "@/lib/ai/models";
import { signInTestUser } from "./session";

const CANDIDATES = (process.env.EVAL_CHAT_MODELS ?? models.chat).split(",");
const TODAY = "2026-10-21";
// Matches the chat route; EVAL_REASONING=default uses the provider's default.
const REASONING = process.env.EVAL_REASONING === "default" ? undefined : ((process.env.EVAL_REASONING ?? "none") as "none" | "low");

type Case = { q: string; expect?: string[]; forbidAllNames?: boolean };
type Result = {
  q: string;
  ok: boolean;
  costUsd: number;
  latencyMs: number;
  error?: string;
  missing?: string[];
  leaked?: string[];
  badCitations?: string[];
  citations?: number;
  tools?: string[];
  steps?: number;
  answer?: string;
};

const CASES: Case[] = [
  { q: "Who did I meet from Northwind?", expect: ["Priya Shah", "Daniel Okafor", "Mei Lin", "Arjun Mehta"] },
  { q: "Which software developers do I know?", expect: ["Daniel Okafor", "Omar Haddad", "Marcus Johnson", "Kenji Watanabe"] },
  {
    q: "Who did I meet at the HealthTech Expo?",
    expect: ["Hannah Schmidt", "Ravi Iyer", "Grace Park", "Omar Haddad", "Ingrid Larsen", "Jonas Weber", "Yuki Tanaka", "Ben Carter"],
  },
  { q: "Neha needs a cold-chain logistics partner for Dubai. Who in my network could help?", expect: ["Elena Petrova"] },
  { q: "Which investors do I know?", expect: ["Lucas Moreau", "Hannah Schmidt"] },
  { q: "Who was interested in warehouse automation?", expect: ["Priya Shah"] },
  { q: "Who is hiring Rust developers?", expect: ["Daniel Okafor"] },
  { q: "How many people do I know at Bluefin Analytics?", expect: ["3"] },
  { q: "Who do I know in Berlin?", expect: ["Hannah Schmidt", "Ravi Iyer", "Grace Park", "Omar Haddad", "Ingrid Larsen", "Jonas Weber"] },
  { q: "Which founders have I met?", expect: ["Neha Kapoor"] },
  { q: "What did Arjun promise to send me?", expect: ["pricing deck"] },
  { q: "Who do I need to follow up with?", expect: ["Arjun Mehta", "Tom Becker", "Grace Park"] },
  { q: "Who speaks Japanese?", expect: ["Kenji Watanabe"] },
  {
    q: "Who did I meet in June 2026?",
    expect: ["Sofia Rossi", "Tom Becker", "Aisha Khan", "Fatima Noor", "Kenji Watanabe", "Samuel Adeyemi", "Anna Kowalski"],
  },
  { q: "Which designers have I met?", expect: ["Mei Lin", "Grace Park", "Zoe Martin"] },
  { q: "Who works in fintech?", expect: ["Kenji Watanabe", "Laura Bianchi", "Samuel Adeyemi"] },
  { q: "What's Tom Becker's email address?", expect: ["tom.becker@bluefin.example"] },
  { q: "Is anyone in my network looking for a new job?", expect: ["Grace Park"] },
  { q: "Which company has the most people in my network?", expect: ["Northwind Robotics"] },
  { q: "Who did I meet from Initech?", forbidAllNames: true },
];

const network = JSON.parse(readFileSync("fixtures/network.json", "utf8")) as { contacts: { name: string }[] };
const ALL_NAMES = network.contacts.map((c) => c.name);

describe("ask my network", () => {
  it("answers questions about the seeded network", { timeout: 900_000 }, async () => {
    const { supabase, userId } = await signInTestUser();
    const { data: ids } = await supabase.from("contacts").select("id");
    const realIds = new Set((ids ?? []).map((r) => r.id));
    expect(realIds.size).toBe(ALL_NAMES.length);

    const report: Record<string, unknown>[] = [];
    for (const model of CANDIDATES) {
      const results: Result[] = [];
      const queue = CASES.map((c, i) => ({ c, i }));
      const run = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          const { c, i } = next;
          const ctx: AskContext = { supabase, userId, usage: [] };
          const started = Date.now();
          try {
            const r = await generateText({
              model: chatModel(model, { reasoning: REASONING }),
              instructions: askInstructions({ name: "Test User", today: TODAY, timeZone: "UTC" }),
              prompt: c.q,
              tools: createAskTools(ctx),
              stopWhen: isStepCount(6),
              maxOutputTokens: 1500,
            });
            const text = r.text;
            const lower = text.toLowerCase();
            const missing = (c.expect ?? []).filter((e) => !lower.includes(e.toLowerCase()));
            const leaked = c.forbidAllNames ? ALL_NAMES.filter((n) => text.includes(n)) : [];
            const cited = [...text.matchAll(/\(contact:([0-9a-f-]{36})\)/g)].map((m) => m[1]);
            const badCitations = cited.filter((id) => !realIds.has(id));
            results[i] = {
              q: c.q,
              ok: missing.length === 0 && leaked.length === 0 && badCitations.length === 0,
              missing,
              leaked,
              badCitations,
              citations: cited.length,
              tools: r.steps.flatMap((s) => s.toolCalls.map((t) => t.toolName)),
              steps: r.steps.length,
              costUsd: r.steps.reduce((sum, s) => sum + costOf(s), 0) + ctx.usage.reduce((sum, u) => sum + u.costUsd, 0),
              latencyMs: Date.now() - started,
              answer: text,
            };
          } catch (err) {
            results[i] = { q: c.q, ok: false, error: err instanceof Error ? err.message : String(err), costUsd: 0, latencyMs: Date.now() - started };
          }
        }
      };
      await Promise.all([run(), run(), run(), run()]);

      const passed = results.filter((r) => r.ok).length;
      const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
      const row = {
        model,
        accuracy: Number(((passed / CASES.length) * 100).toFixed(1)),
        avgCostUsd: Number((results.reduce((s, r) => s + r.costUsd, 0) / CASES.length).toFixed(5)),
        p50LatencyMs: latencies[Math.floor(latencies.length / 2)],
        failures: results
          .filter((r) => !r.ok)
          .map((r) => ({ q: r.q, ...(r.error ? { error: r.error } : { missing: r.missing, leaked: r.leaked, badCitations: r.badCitations, answer: r.answer }) })),
        results,
      };
      report.push(row);
      console.log(`${model}: ${row.accuracy}% correct, $${row.avgCostUsd}/question, p50 ${row.p50LatencyMs}ms`);
      for (const f of row.failures) console.log("  ✗", JSON.stringify(f).slice(0, 600));
    }

    mkdirSync("evals/results", { recursive: true });
    writeFileSync(`evals/results/ask-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(report, null, 2));
  });
});
