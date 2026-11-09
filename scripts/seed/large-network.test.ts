import { describe, expect, it } from "vitest";
import { findCompanyMatch } from "@/lib/companies";
import { canonicalIndustry, isIndustry } from "@/lib/industries";
import { largeNetwork } from "./large-network";

const INTERACTION_TYPES = new Set(["met", "email", "call", "meeting", "message"]);

describe("largeNetwork", () => {
  const { fixture, truth } = largeNetwork();

  it("is the same on every run", () => {
    expect(JSON.stringify(largeNetwork().fixture)).toBe(JSON.stringify(fixture));
  });

  it("has about 500 people with unique names, emails and phone numbers", () => {
    const people = fixture.contacts;
    expect(people.length).toBeGreaterThan(450);
    expect(people.length).toBeLessThan(560);
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(people.map((p) => p.name))).toBe(true);
    expect(unique(people.map((p) => p.email).filter(Boolean))).toBe(true);
    expect(unique(people.flatMap((p) => (p.phone ? [p.phone] : [])))).toBe(true);
    for (const p of people) expect(p.email === "" || p.email.endsWith(".example"), p.email).toBe(true);
  });

  it("only refers to events that exist and uses industries from the list", () => {
    const events = new Set(fixture.events.map((e) => e.key));
    for (const p of fixture.contacts) {
      expect(p.met.length).toBeGreaterThan(0);
      for (const [what] of p.met) expect(events.has(what) || INTERACTION_TYPES.has(what), what).toBe(true);
      expect(isIndustry(canonicalIndustry(p.industry)), p.industry).toBe(true);
    }
  });

  it("folds every spelling of a company into one, and keeps look-alikes apart", () => {
    const companies: { id: string; name: string; domain: string | null }[] = [];
    const companyOf = new Map<string, string>();
    for (const p of fixture.contacts) {
      if (!p.company) continue;
      const domain = p.email.split("@")[1] || null;
      let match = findCompanyMatch(companies, { name: p.company, domain });
      if (!match) companies.push((match = { id: String(companies.length), name: p.company, domain }));
      match.domain ??= domain;
      companyOf.set(p.name, match.id);
    }
    for (const [main, variants] of truth.companyVariants) {
      const ids = new Set(fixture.contacts.filter((p) => p.company === main || variants.includes(p.company ?? "")).map((p) => companyOf.get(p.name)));
      expect(ids.size, main).toBe(1);
    }
    for (const [a, b] of truth.lookAlikes) {
      const idOf = (name: string) => companyOf.get(fixture.contacts.find((p) => p.company === name)!.name);
      expect(idOf(a)).not.toBe(idOf(b));
    }
    expect(truth.companyVariants.size).toBeGreaterThan(15);
  });

  it("has known connectors, ties and past jobs to check later work against", () => {
    expect(truth.connectors.size).toBeGreaterThan(30);
    for (const kind of ["introduced", "knows", "former_colleague"] as const) {
      expect(truth.ties.filter((t) => t[2] === kind).length, kind).toBeGreaterThan(10);
    }
    expect(truth.pastJobs.some((j) => j.recorded)).toBe(true);
    expect(truth.pastJobs.some((j) => !j.recorded)).toBe(true);
    // Some introductions are recorded as links; the rest are only in notes, for the AI to find.
    const told = truth.ties.filter(([, , kind]) => kind !== "former_colleague");
    expect(told.filter((t) => t[3]).length).toBeGreaterThan(20);
    expect(told.filter((t) => !t[3]).length).toBeGreaterThan(40);
    const names = new Set(fixture.contacts.map((p) => p.name));
    for (const p of fixture.contacts) for (const l of p.links ?? []) expect(names.has(l.to), l.to).toBe(true);
  });
});
