import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/export/csv";
import { toVCard } from "@/lib/export/vcard";

describe("toVCard", () => {
  it("builds a vCard 3.0 with escaped values", () => {
    const v = toVCard({
      fullName: "Ananya Rao",
      title: "Senior Engineer, Platform",
      company: "XYZ; Inc",
      emails: ["a@x.example"],
      phones: ["+14155550123"],
      website: "x.example",
    });
    expect(v).toContain("BEGIN:VCARD\r\nVERSION:3.0\r\n");
    expect(v).toContain("N:Rao;Ananya;;;");
    expect(v).toContain("TITLE:Senior Engineer\\, Platform");
    expect(v).toContain("ORG:XYZ\\; Inc");
    expect(v).toContain("EMAIL;TYPE=INTERNET,PREF:a@x.example");
    expect(v).toContain("URL:https://x.example");
    expect(v.endsWith("END:VCARD\r\n")).toBe(true);
  });

  it("folds long lines without splitting characters", () => {
    const v = toVCard({ fullName: "田中 健太", note: "メモ".repeat(40) });
    for (const line of v.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    expect(v).toContain("FN:田中 健太");
  });
});

describe("toCsv", () => {
  it("quotes, escapes and defuses formulas", () => {
    const csv = toCsv(["a", "b"], [["=1+1", 'say "hi", ok'], [null, "line\nbreak"]]);
    expect(csv.startsWith("﻿a,b\r\n")).toBe(true);
    expect(csv).toContain(`'=1+1,"say ""hi"", ok"`);
    expect(csv).toContain(`,"line\nbreak"`);
  });

  it("leaves phone numbers alone but still defuses formulas that start with +", () => {
    const csv = toCsv(["p"], [["+14155550123"], ["+1 (415) 555-0123"], ["+SUM(A1)"], ["-2+3*cmd|' /C calc'!A0"]]);
    expect(csv).toContain("\r\n+14155550123\r\n");
    expect(csv).toContain("\r\n+1 (415) 555-0123\r\n");
    expect(csv).toContain("'+SUM(A1)");
    expect(csv).toContain(`"'-2+3*cmd|' /C calc'!A0"`.replace(/"/g, ""));
  });
});
