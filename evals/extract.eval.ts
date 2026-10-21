// Live extraction eval: runs candidate vision models over the fixture cards and
// reports field accuracy, cost and latency. Costs a few cents.
//   pnpm eval                       default candidates
//   EVAL_MODELS=a/b,c/d pnpm eval   specific models
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { readCard } from "@/lib/ai/extract";
import { normalizeAndValidate } from "@/lib/ai/validate";
import { prepareForModel } from "@/lib/images";
import { scoreCard, type Expected } from "./score";

process.loadEnvFile?.(".env.local");

const CANDIDATES = (
  process.env.EVAL_MODELS ??
  "anthropic/claude-haiku-5.5,mistralai/mistral-small-3.2-24b-instruct,google/gemma-3-27b-it,qwen/qwen3-vl-30b-a3b-instruct"
).split(",");

type Fixture = { id: string; front: string; back?: string; expected: Expected };
const fixtures: Fixture[] = JSON.parse(readFileSync("fixtures/cards/expected.json", "utf8"));

describe("card extraction", () => {
  it("compares models", { timeout: 600_000 }, async () => {
    const images = await Promise.all(
      fixtures.map(async (f) =>
        Promise.all([f.front, f.back].filter(Boolean).map((p) => prepareForModel(readFileSync(`fixtures/cards/${p}`)))),
      ),
    );

    const report: Record<string, unknown>[] = [];
    for (const model of CANDIDATES) {
      let correct = 0;
      let total = 0;
      let cost = 0;
      const latencies: number[] = [];
      let escalations = 0;
      const misses: string[] = [];

      // Cards run in parallel per model; models run one after another.
      const results = await Promise.all(fixtures.map((f, i) => readCard(model, images[i], false).then((r) => ({ f, r }))));
      for (const { f, r } of results) {
        cost += r.usage.costUsd;
        latencies.push(r.usage.latencyMs);
        if (!r.card) {
          misses.push(`${f.id}: no result`);
          total += Object.keys(f.expected).length;
          continue;
        }
        const { card, validation } = normalizeAndValidate(r.card);
        if (validation.shouldEscalate) escalations++;
        for (const s of scoreCard(card, f.expected)) {
          total++;
          if (s.ok) correct++;
          else misses.push(`${f.id}.${s.field}: got ${JSON.stringify(s.got)} want ${JSON.stringify(s.want)}`);
        }
      }
      latencies.sort((a, b) => a - b);
      const row = {
        model,
        accuracy: Number(((correct / total) * 100).toFixed(1)),
        costPerCard: Number((cost / fixtures.length).toFixed(5)),
        p50ms: latencies[Math.floor(latencies.length / 2)],
        wouldEscalate: escalations,
        misses,
      };
      report.push(row);
      console.log(`\n${model}\n  accuracy ${row.accuracy}%  cost/card $${row.costPerCard}  p50 ${row.p50ms}ms  escalations ${escalations}`);
      for (const m of misses) console.log(`   ✗ ${m}`);
    }

    mkdirSync("evals/results", { recursive: true });
    writeFileSync(`evals/results/extract-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`, JSON.stringify(report, null, 2));
  });
});
