import { describe, expect, it } from "vitest";
import { largeNetwork } from "@/scripts/seed/large-network";
import { findCompanyMatch } from "@/lib/companies";
import { employerResolver, formerColleagues, statedFrom, untilLabel } from "@/lib/connections";

const companies = [
  { id: "c1", name: "XYZ Technologies" },
  { id: "c2", name: "Bluefin Analytics" },
];

describe("employerResolver", () => {
  it("matches a past job to one of the user's companies under any spelling", () => {
    const resolve = employerResolver(companies);
    expect(resolve("XYZ Tech Pvt Ltd")).toEqual({ id: "c1", name: "XYZ Technologies" });
    expect(resolve("Quanta Legal")).toEqual({ id: "past:quanta legal", name: "Quanta Legal" });
    expect(resolve("")).toBeNull();
  });
});

describe("formerColleagues", () => {
  it("links someone's past employer to the people there now, and to others who left", () => {
    const pairs = formerColleagues(
      [
        { id: "ana", companyId: "c2", pastCompanies: ["XYZ Tech"] },
        { id: "ben", companyId: "c1", pastCompanies: [] },
        { id: "cy", companyId: null, pastCompanies: ["XYZ Technologies Inc."] },
        { id: "di", companyId: "c2", pastCompanies: [] },
      ],
      companies,
    );
    expect(pairs.map((p) => [p.a, p.b, p.how.kind]).sort()).toEqual([
      ["ana", "ben", "past_current"],
      ["ana", "cy", "both_past"],
      ["ben", "cy", "past_current"],
    ]);
    // Colleagues at the same company today aren't "former" colleagues.
    expect(pairs.some((p) => [p.a, p.b].includes("di"))).toBe(false);
  });

  it("ignores a past job at the company they're at now", () => {
    expect(formerColleagues([{ id: "ana", companyId: "c1", pastCompanies: ["XYZ Tech"] }, { id: "ben", companyId: "c1", pastCompanies: [] }], companies)).toEqual([]);
  });

  it("finds every former colleague the test network recorded", () => {
    const { fixture, truth } = largeNetwork();
    // Companies as the seeder creates them: every spelling folded into one.
    const list: { id: string; name: string; domain: string | null }[] = [];
    const people = fixture.contacts.map((c) => {
      let companyId: string | null = null;
      if (c.company) {
        const domain = c.email.split("@")[1] || null;
        const match = findCompanyMatch(list, { name: c.company, domain });
        companyId = match?.id ?? String(list.push({ id: String(list.length), name: c.company, domain }) - 1);
      }
      return { id: c.name, companyId, pastCompanies: (c.pastPositions ?? []).map((p) => p.company) };
    });

    const found = new Set(formerColleagues(people, list).map((p) => `${p.a}|${p.b}`));
    const recorded = new Set(truth.pastJobs.filter((j) => j.recorded).map((j) => j.person));
    const expected = truth.ties.filter(([a, , kind]) => kind === "former_colleague" && recorded.has(a)).map(([a, b]) => (a < b ? `${a}|${b}` : `${b}|${a}`));
    expect(expected.length).toBeGreaterThan(50);
    expect(expected.filter((pair) => !found.has(pair))).toEqual([]);
  });
});

describe("statedFrom", () => {
  it("reads each kind of link from either side", () => {
    const intro = { id: "l", contactId: "ana", otherId: "ben", kind: "introduced_by" as const, source: "user" as const };
    expect(statedFrom(intro, "ana")).toEqual({ otherId: "ben", label: "Introduced by" });
    expect(statedFrom(intro, "ben")).toEqual({ otherId: "ana", label: "Introduced you to" });
    expect(statedFrom({ ...intro, kind: "knows" }, "ben")).toEqual({ otherId: "ana", label: "Knows" });
  });
});

describe("untilLabel", () => {
  it("shows a month or a day, depending on what was recorded", () => {
    expect(untilLabel("2024-06")).toBe("Jun 2024");
    expect(untilLabel("2026-10-12")).toBe("Oct 12, 2026");
    expect(untilLabel(null)).toBeNull();
  });
});
