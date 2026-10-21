// Live voice-note eval: transcription, summary and follow-up extraction on the
// synthetic recordings in fixtures/voice (regenerate them with
// `node scripts/make-voice-fixtures.mjs`). Costs well under a cent.
//   pnpm eval voice
//   EVAL_VOICE_MODELS=a/b,c/d pnpm eval voice
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { models } from "@/lib/ai/models";
import { processVoiceNote, sniffAudio } from "@/lib/ai/voice";
import { extractFollowUps } from "@/lib/suggestions";
import "./session";

// "model" or "model@low" to try a model with reasoning on.
const CANDIDATES = (process.env.EVAL_VOICE_MODELS ?? `${models.voice}@${models.voiceReasoning}`).split(",");
const TODAY = "2026-10-21";

type Fixture = {
  id: string;
  about: string;
  mustInclude: string[];
  followUps: { mentions: string; dueIn: string[] }[];
};
const fixtures: Fixture[] = JSON.parse(readFileSync("fixtures/voice/expected.json", "utf8"));

describe("voice notes", () => {
  it("transcribes and finds follow-ups", { timeout: 600_000 }, async () => {
    const report = [];
    for (const candidate of CANDIDATES) {
      const [model, reasoning = "none"] = candidate.split("@") as [string, "none" | "low"];
      const results = await Promise.all(
        fixtures.map(async (f) => {
          const audio = readFileSync(`fixtures/voice/${f.id}.m4a`);
          try {
            const { note, usage } = await processVoiceNote(audio, sniffAudio(audio)!, { about: f.about, today: TODAY, timeZone: "Asia/Kolkata" }, { model, reasoning });
            const text = `${note.transcript}\n${note.summary}`.toLowerCase();
            const problems: string[] = [];
            for (const m of f.mustInclude) if (!text.includes(m.toLowerCase())) problems.push(`missing "${m}"`);
            if (note.followUps.length !== f.followUps.length) problems.push(`${note.followUps.length} follow-ups, want ${f.followUps.length}`);
            for (const want of f.followUps) {
              const got = note.followUps.find((x) => x.action.toLowerCase().includes(want.mentions));
              if (!got) problems.push(`no follow-up about "${want.mentions}"`);
              else if (!want.dueIn.includes(got.dueDate ?? "")) problems.push(`"${want.mentions}" due ${got.dueDate}`);
            }
            if (!note.summary.trim()) problems.push("empty summary");
            return { id: f.id, ok: problems.length === 0, problems, costUsd: usage.costUsd, latencyMs: usage.latencyMs, note };
          } catch (err) {
            return { id: f.id, ok: false, problems: [err instanceof Error ? err.message.slice(0, 200) : String(err)], costUsd: 0, latencyMs: 0 };
          }
        }),
      );
      const row = {
        model: candidate,
        passed: `${results.filter((r) => r.ok).length}/${results.length}`,
        avgCostUsd: Number((results.reduce((s, r) => s + r.costUsd, 0) / results.length).toFixed(5)),
        avgLatencyMs: Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length),
        results,
      };
      report.push(row);
    }
    mkdirSync("evals/results", { recursive: true });
    writeFileSync(`evals/results/voice-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(report, null, 2));
  });
});

const TYPED: { note: string; followUps: { mentions: string; dueIn: string[] }[] }[] = [
  { note: "Great chat about warehouse robots. I'll send her the case study on Monday.", followUps: [{ mentions: "case study", dueIn: ["2026-10-26"] }] },
  { note: "Loves trekking, has two kids, based in Mumbai.", followUps: [] },
  {
    note: "Need to book a demo with their team before the end of the month, and email Lucas about the intro tomorrow.",
    followUps: [
      { mentions: "demo", dueIn: ["2026-10-30", "2026-10-31"] },
      { mentions: "lucas", dueIn: ["2026-10-22"] },
    ],
  },
];

describe("typed notes", () => {
  it("finds follow-ups, and skips the AI call when there can't be any", { timeout: 120_000 }, async () => {
    const results = await Promise.all(TYPED.map((t) => extractFollowUps(t.note, { about: "Priya Shah (Senior Product Manager at Northwind Robotics)", today: TODAY })));
    expect(results[1].usage).toBeNull();
    results.forEach((r, i) => {
      expect(r.items).toHaveLength(TYPED[i].followUps.length);
      for (const want of TYPED[i].followUps) {
        const got = r.items.find((x) => x.action.toLowerCase().includes(want.mentions));
        expect(got, `${TYPED[i].note} → ${want.mentions}`).toBeTruthy();
        expect(want.dueIn).toContain(got!.dueDate);
      }
    });
  });
});
