// Live eval of reading notes (follow-ups, connections, past jobs, topics). The
// answers come from the generated 500-person network, which knows which notes
// mention an introduction, a friend, a past employer or a topic. Costs about
// two cents.
//   pnpm eval notes
//   EVAL_NOTE_MODELS=a/b,c/d pnpm eval notes
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeNote, NOTE_PROMPT_VERSION, type NoteAnalysis } from "@/lib/ai/note-analysis";
import { models } from "@/lib/ai/models";
import { sameCompany } from "@/lib/companies";
import { normalizeTopic } from "@/lib/topics";
import { largeNetwork } from "@/scripts/seed/large-network";
import "./session";

const CANDIDATES = (process.env.EVAL_NOTE_MODELS ?? models.chat).split(",");
const TODAY = "2026-10-21";
const HOBBIES = /trek|marathon|chess|sail|photograph|jazz|cricket|cycl|cook|bird|climb|padel/i;

const { fixture, truth } = largeNetwork();
const byName = new Map(fixture.contacts.map((c) => [c.name, c]));
const allTopics = [...new Set([...truth.topicsOf.values()].flat())];

type Expected = { people: { name: string; relation: string }[]; pastJobs: string[]; topics: string[]; promise: boolean };

/** Everyone whose notes hold something to find, plus some whose notes hold only topics. */
function sample() {
  const picked = new Map<string, Expected>();
  const expect = (name: string) => {
    const p = byName.get(name)!;
    return (
      picked.get(name) ??
      picked
        .set(name, { people: [], pastJobs: [], topics: truth.topicsOf.get(name) ?? [], promise: (p.notes ?? []).some((n) => n.startsWith("Promised")) })
        .get(name)!
    );
  };
  for (const [a] of truth.ties.filter((t) => t[2] === "introduced").slice(0, 12)) expect(a);
  for (const [a] of truth.ties.filter((t) => t[2] === "knows").slice(0, 8)) expect(a);
  for (const j of truth.pastJobs.filter((x) => !x.recorded).slice(0, 10)) expect(j.person);
  for (const p of fixture.contacts.filter((c) => c.notes?.length && !picked.has(c.name)).slice(0, 10)) expect(p.name);
  for (const p of fixture.contacts.filter((c) => c.notes?.some((n) => n.startsWith("Promised")) && !picked.has(c.name)).slice(0, 4)) expect(p.name);
  // Everything each picked person's notes say, so a right answer is never counted as extra.
  for (const [name, want] of picked) {
    for (const [a, b, kind] of truth.ties) if (a === name && kind !== "former_colleague") want.people.push({ name: b, relation: kind === "introduced" ? "introduced_by" : kind });
    for (const j of truth.pastJobs) if (j.person === name && !j.recorded) want.pastJobs.push(j.company);
  }
  return picked;
}

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

const same = (a: string, b: string) => a.toLowerCase().replace(/\s+/g, " ").trim() === b.toLowerCase().replace(/\s+/g, " ").trim();
const topicMatch = (want: string, got: string[]) => got.some((g) => g.includes(normalizeTopic(want)!) || normalizeTopic(want)!.includes(g));

describe("reading notes", () => {
  it("finds what notes say about people, and nothing they don't", { timeout: 900_000 }, async () => {
    const people = sample();
    const report: Record<string, unknown>[] = [];

    for (const model of CANDIDATES) {
      const tally = { people: { found: 0, expected: 0, extra: 0 }, pastJobs: { found: 0, expected: 0, extra: 0 }, topics: { found: 0, expected: 0, hobbies: 0 }, followUps: { promised: 0, caught: 0, invented: 0 } };
      const problems: string[] = [];
      let cost = 0;
      const latencies: number[] = [];

      const jobs = [...people].flatMap(([name, want]) => (byName.get(name)!.notes ?? []).map((note) => ({ name, want, note })));
      const results = new Map<string, NoteAnalysis[]>();
      const queue = [...jobs];
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          for (let job = queue.shift(); job; job = queue.shift()) {
            const p = byName.get(job.name)!;
            const { analysis, usage } = await analyzeNote(
              job.note,
              { about: `${p.name}, ${p.title}${p.company ? ` at ${p.company}` : ""}`, firstName: p.name.split(" ")[0], company: p.company, today: TODAY, topics: allTopics, followUps: true },
              { model },
            );
            cost += usage.costUsd;
            latencies.push(usage.latencyMs);
            results.set(job.name, [...(results.get(job.name) ?? []), analysis]);
          }
        }),
      );

      for (const [name, want] of people) {
        const got = results.get(name) ?? [];
        const gotPeople = got.flatMap((a) => a.people);
        const gotJobs = got.flatMap((a) => a.pastJobs);
        const gotTopics = got.flatMap((a) => a.topics.map((t) => normalizeTopic(t) ?? t));

        tally.people.expected += want.people.length;
        for (const w of want.people) {
          if (gotPeople.some((g) => same(g.name, w.name) && g.relation === w.relation)) tally.people.found++;
          else problems.push(`${name}: missed ${w.relation} ${w.name} (got ${JSON.stringify(gotPeople)})`);
        }
        for (const g of gotPeople) {
          if (!want.people.some((w) => same(g.name, w.name))) {
            tally.people.extra++;
            problems.push(`${name}: extra person ${g.name} (${g.relation})`);
          }
        }

        tally.pastJobs.expected += want.pastJobs.length;
        for (const w of want.pastJobs) {
          if (gotJobs.some((g) => sameCompany({ name: g.company }, { name: w }))) tally.pastJobs.found++;
          else problems.push(`${name}: missed past job ${w} (got ${JSON.stringify(gotJobs)})`);
        }
        for (const g of gotJobs) {
          if (!want.pastJobs.some((w) => sameCompany({ name: g.company }, { name: w }))) {
            tally.pastJobs.extra++;
            problems.push(`${name}: extra past job ${g.company}`);
          }
        }

        tally.topics.expected += want.topics.length;
        for (const w of want.topics) if (topicMatch(w, gotTopics)) tally.topics.found++;
        for (const t of gotTopics) {
          if (HOBBIES.test(t)) {
            tally.topics.hobbies++;
            problems.push(`${name}: hobby as a topic: ${t}`);
          }
        }

        const followUps = got.flatMap((a) => a.followUps);
        if (want.promise) {
          tally.followUps.promised++;
          if (followUps.length) tally.followUps.caught++;
          else problems.push(`${name}: missed the promised follow-up`);
        } else if (followUps.length) {
          tally.followUps.invented += followUps.length;
          problems.push(`${name}: invented follow-up ${JSON.stringify(followUps)}`);
        }
      }

      // The typed follow-up cases, with dates.
      for (const t of TYPED) {
        const { analysis, usage } = await analyzeNote(
          t.note,
          { about: "Priya Shah, Senior Product Manager at Northwind Robotics", firstName: "Priya", company: "Northwind Robotics", today: TODAY, topics: [], followUps: true },
          { model },
        );
        cost += usage.costUsd;
        if (analysis.followUps.length !== t.followUps.length) problems.push(`typed "${t.note}": ${analysis.followUps.length} follow-ups, expected ${t.followUps.length}`);
        for (const want of t.followUps) {
          const got = analysis.followUps.find((x) => x.action.toLowerCase().includes(want.mentions));
          if (!got || !want.dueIn.includes(got.dueDate ?? "")) problems.push(`typed "${t.note}": ${want.mentions} → ${JSON.stringify(got)}`);
        }
      }

      const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 100);
      latencies.sort((a, b) => a - b);
      const row = {
        model,
        promptVersion: NOTE_PROMPT_VERSION,
        notes: jobs.length + TYPED.length,
        peopleRecall: pct(tally.people.found, tally.people.expected),
        extraPeople: tally.people.extra,
        pastJobRecall: pct(tally.pastJobs.found, tally.pastJobs.expected),
        extraPastJobs: tally.pastJobs.extra,
        topicRecall: pct(tally.topics.found, tally.topics.expected),
        hobbyTopics: tally.topics.hobbies,
        followUpsCaught: `${tally.followUps.caught}/${tally.followUps.promised}`,
        inventedFollowUps: tally.followUps.invented,
        avgCostUsd: Number((cost / (jobs.length + TYPED.length)).toFixed(5)),
        p50LatencyMs: latencies[Math.floor(latencies.length / 2)],
        problems,
      };
      report.push(row);
      process.stderr.write(`${JSON.stringify({ ...row, problems: problems.length })}\n${problems.map((p) => `  ✗ ${p}`).join("\n")}\n`);
    }

    mkdirSync("evals/results", { recursive: true });
    writeFileSync(`evals/results/notes-${new Date().toISOString().replace(/[:.]/g, "-")}.json`, JSON.stringify(report, null, 2));
    const best = report[0] as { peopleRecall: number; pastJobRecall: number; topicRecall: number; hobbyTopics: number };
    expect(best.peopleRecall).toBeGreaterThanOrEqual(90);
    expect(best.pastJobRecall).toBeGreaterThanOrEqual(90);
    expect(best.topicRecall).toBeGreaterThanOrEqual(80);
    expect(best.hobbyTopics).toBe(0);
  });
});
