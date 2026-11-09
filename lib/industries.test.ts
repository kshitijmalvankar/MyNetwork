import { describe, expect, it } from "vitest";
import { canonicalIndustry, INDUSTRIES, sectorOf } from "@/lib/industries";

describe("canonicalIndustry", () => {
  it("keeps labels from the list, ignoring case and '&' vs 'and'", () => {
    for (const industry of INDUSTRIES) expect(canonicalIndustry(industry.toUpperCase())).toBe(industry);
    expect(canonicalIndustry("food and beverage")).toBe("Food & beverage");
  });

  it("maps common variants", () => {
    const cases: [string, string][] = [
      ["FinTech", "Fintech"],
      ["Payments", "Fintech"],
      ["Financial Services", "Banking"],
      ["Venture Capital", "Investment"],
      ["Cloud Software", "Software"],
      ["SaaS", "Software"],
      ["Information Technology & Services", "Software"],
      ["Data & AI", "AI & data"],
      ["EdTech", "Education"],
      ["HealthTech", "Healthcare"],
      ["Hospital & Health Care", "Healthcare"],
      ["Biotech", "Biotech & pharma"],
      ["Pharmaceuticals", "Biotech & pharma"],
      ["Renewable Energy", "Energy & climate"],
      ["Oil & Gas", "Energy & climate"],
      ["Management Consulting", "Consulting"],
      ["Legal Services", "Legal"],
      ["Design Services", "Design"],
      ["Logistics and Supply Chain", "Logistics"],
      ["Staffing & Recruiting", "Recruiting & HR"],
      ["Real Estate", "Construction & real estate"],
      ["Apparel & Fashion", "Consumer goods"],
      ["F&B", "Food & beverage"],
      ["Computer Games", "Media & entertainment"],
    ];
    for (const [input, expected] of cases) expect(canonicalIndustry(input), input).toBe(expected);
  });

  it("returns null when nothing fits", () => {
    expect(canonicalIndustry("")).toBeNull();
    expect(canonicalIndustry(null)).toBeNull();
    expect(canonicalIndustry("Miscellaneous")).toBeNull();
  });
});

describe("sectorOf", () => {
  it("groups related industries", () => {
    expect(sectorOf("Fintech")).toBe("Finance");
    expect(sectorOf("Banking")).toBe("Finance");
    expect(sectorOf("Cloud Software")).toBeNull();
  });
});
