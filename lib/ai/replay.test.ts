import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashEmbedding } from "@/lib/ai/hashed-embedding";
import { adaptResponse, normalizeText, requestKeys } from "@/lib/ai/replay";

const prompt = (text: string, image?: Uint8Array) => [
  { role: "system" as const, content: "Today is Thursday, 2026-10-22." },
  {
    role: "user" as const,
    content: [{ type: "text" as const, text }, ...(image ? [{ type: "file" as const, mediaType: "image/jpeg", data: { type: "data" as const, data: image } }] : [])],
  },
];

describe("request keys", () => {
  it("ignore ids, dates and weekdays", () => {
    expect(normalizeText(`Met ${randomUUID()} on 2026-09-18T10:00:00Z, a Friday in 2026-09 (Sep 18, 2026)`)).toBe(
      "Met <id> on <date>, a <weekday> in <month> (<date>)",
    );
    const a = requestKeys("m", {}, { prompt: prompt(`Contact ${randomUUID()} met 2026-09-01`) });
    const b = requestKeys("m", {}, { prompt: prompt(`Contact ${randomUUID()} met 2026-11-30`) });
    expect(a.key).toBe(b.key);
  });

  it("tell different files apart exactly, but not loosely", () => {
    const a = requestKeys("m", {}, { prompt: prompt("Read this card", new Uint8Array([1, 2, 3])) });
    const b = requestKeys("m", {}, { prompt: prompt("Read this card", new Uint8Array([4, 5, 6])) });
    expect(a.key).not.toBe(b.key);
    expect(a.looseKey).toBe(b.looseKey);
  });

  it("loosely ignore counts, which drift with the calendar", () => {
    const a = requestKeys("m", {}, { prompt: prompt("Not in touch for 3 months: 12 (38%)") });
    const b = requestKeys("m", {}, { prompt: prompt("Not in touch for 3 months: 14 (44%)") });
    expect(a.key).not.toBe(b.key);
    expect(a.looseKey).toBe(b.looseKey);
  });

  it("depend on the model and its settings", () => {
    const p = { prompt: prompt("Hi") };
    expect(requestKeys("a", {}, p).key).not.toBe(requestKeys("b", {}, p).key);
    expect(requestKeys("a", { reasoning: "none" }, p).key).not.toBe(requestKeys("a", {}, p).key);
  });
});

describe("adapting a recorded response", () => {
  it("swaps recorded ids for the ones at the same place in the new request", () => {
    const [oldA, oldB, newA, newB] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const response = {
      content: [{ type: "text" as const, text: `[Priya](contact:${oldB}) and [Ana](contact:${oldA})` }],
      finishReason: { unified: "stop" as const, raw: "stop" },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    };
    const adapted = adaptResponse({ ids: [oldA, oldB, oldA], recordedOn: "2026-10-22", response }, [newA, newB, newA], "2026-10-22");
    expect(adapted.content[0]).toEqual({ type: "text", text: `[Priya](contact:${newB}) and [Ana](contact:${newA})` });
  });

  it("moves dates by the days since recording", () => {
    const response = {
      content: [{ type: "text" as const, text: '{"due":"2026-10-30"}' }],
      finishReason: { unified: "stop" as const, raw: "stop" },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } },
    };
    const adapted = adaptResponse({ ids: [], recordedOn: "2026-10-22", response }, [], "2026-11-05");
    expect(adapted.content[0]).toEqual({ type: "text", text: '{"due":"2026-11-13"}' });
  });
});

describe("hashed embeddings", () => {
  const cosine = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i], 0);

  it("are unit length and the same every time", () => {
    const v = hashEmbedding("Hiring Rust developers in Pune");
    expect(v).toHaveLength(1536);
    expect(cosine(v, v)).toBeCloseTo(1, 6);
    expect(hashEmbedding("Hiring Rust developers in Pune")).toEqual(v);
  });

  it("put texts that share words closer together", () => {
    const query = hashEmbedding("who is hiring rust developers");
    const related = hashEmbedding("She is hiring two Rust developers for the payments team");
    const unrelated = hashEmbedding("Loves trekking in the Himalayas and has two kids");
    expect(cosine(query, related)).toBeGreaterThan(cosine(query, unrelated));
  });
});
