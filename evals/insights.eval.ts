// Live eval for the Insights summary on the seeded test network. Checks that
// every number it quotes is in the stats it was given, that no person is named,
// and that actions are well formed. Costs a fraction of a cent.
//   pnpm eval insights
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { statsForModel, writeSummary, type NetworkStats } from "@/lib/ai/insights";
import { signInTestUser } from "./session";

const RUNS = 5;
const network = JSON.parse(readFileSync("fixtures/network.json", "utf8")) as { contacts: { name: string }[] };

describe("insights summary", () => {
  it("only states numbers from the stats and names no one", { timeout: 300_000 }, async () => {
    const { supabase } = await signInTestUser();
    const { data, error } = await supabase.rpc("network_insights", { p_time_zone: "Asia/Kolkata" });
    if (error) throw error;
    const stats = data as unknown as NetworkStats;
    const source = statsForModel(stats);
    const known = new Set([...source.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]));

    const runs = await Promise.all(Array.from({ length: RUNS }, () => writeSummary(stats, { name: "Test User", today: "2026-10-22" })));
    const report = runs.map(({ summary, usage }) => {
      const text = [summary.headline, ...summary.observations].join("\n");
      // Percentages are derived, so they're allowed; every other number must come from the stats.
      const invented = [...text.matchAll(/(\d+(?:\.\d+)?)(%?)/g)].filter(([, n, pct]) => !pct && !known.has(n)).map(([m]) => m);
      const named = network.contacts.map((c) => c.name).filter((n) => text.includes(n) || text.includes(n.split(" ")[0] + " "));
      const badActions = summary.actions.filter((a) => (a.kind === "ask") !== Boolean(a.question?.trim()));
      return { summary, invented, named, badActions, costUsd: usage.costUsd, latencyMs: usage.latencyMs };
    });

    mkdirSync("evals/results", { recursive: true });
    writeFileSync(`evals/results/insights-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(report, null, 2));
    for (const r of report) {
      expect(r.invented, JSON.stringify(r.summary)).toEqual([]);
      expect(r.named).toEqual([]);
      expect(r.badActions).toEqual([]);
      expect(r.summary.observations.length).toBeGreaterThanOrEqual(2);
    }
  });
});
