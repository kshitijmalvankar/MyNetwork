import { describe, expect, it } from "vitest";
import type { CardExtraction } from "@/lib/ai/card-schema";
import { parseQrPayload } from "@/lib/ai/qr";
import { normalizeAndValidate, normalizeCompanyName, normalizePhone, normalizeWebsite } from "@/lib/ai/validate";

const base: CardExtraction = {
  isBusinessCard: true,
  fullName: "Ananya Rao",
  nameNative: null,
  title: "Senior Software Engineer",
  titleNative: null,
  company: "XYZ Technologies",
  emails: ["Ananya.Rao@XYZtech.example "],
  phones: [{ number: "+1 (415) 555-0123", kind: "work" }],
  website: "https://www.xyztech.example/about",
  address: null,
  city: null,
  country: "US",
  language: "en",
  roleFamily: "Engineering",
  seniority: "Senior",
  industry: "Software",
  confidence: { fullName: "high", title: "high", company: "high", contact: "high" },
};

describe("normalizeAndValidate", () => {
  it("normalizes contact details and passes a clean card", () => {
    const { card, validation } = normalizeAndValidate(base);
    expect(card.emails).toEqual(["ananya.rao@xyztech.example"]);
    expect(card.phoneNumbers).toEqual(["+14155550123"]);
    expect(card.website).toBe("xyztech.example");
    expect(validation.issues).toEqual([]);
    expect(validation.shouldEscalate).toBe(false);
  });

  it("uses the card's country, then the user's region, for local numbers", () => {
    const jp = normalizeAndValidate({ ...base, country: "JP", phones: [{ number: "03-5555-0142", kind: "work" }] });
    expect(jp.card.phoneNumbers).toEqual(["+81355550142"]);
    const fallback = normalizeAndValidate({ ...base, country: null, phones: [{ number: "98765 43210", kind: "mobile" }] }, "IN");
    expect(fallback.card.phoneNumbers).toEqual(["+919876543210"]);
  });

  it("escalates on unreadable contact details, missing name or low confidence", () => {
    expect(normalizeAndValidate({ ...base, emails: ["ananya at xyz"] }).validation.shouldEscalate).toBe(true);
    expect(normalizeAndValidate({ ...base, phones: [{ number: "12", kind: "work" }] }).validation.shouldEscalate).toBe(true);
    expect(normalizeAndValidate({ ...base, fullName: "" }).validation.shouldEscalate).toBe(true);
    expect(normalizeAndValidate({ ...base, emails: [], phones: [] }).validation.shouldEscalate).toBe(true);
    expect(
      normalizeAndValidate({ ...base, confidence: { ...base.confidence, company: "low" } }).validation.shouldEscalate,
    ).toBe(true);
  });

  it("does not escalate things that are not business cards", () => {
    expect(normalizeAndValidate({ ...base, isBusinessCard: false, fullName: "" }).validation.shouldEscalate).toBe(false);
  });
});

describe("normalizers", () => {
  it("normalizes company names for matching", () => {
    expect(normalizeCompanyName("XYZ Technologies, Inc.")).toBe("xyz technologies");
    expect(normalizeCompanyName("Chai & Code Labs Pvt. Ltd.")).toBe("chai and code labs");
    expect(normalizeCompanyName("Café Société GmbH")).toBe("cafe societe");
  });

  it("normalizes websites and rejects junk", () => {
    expect(normalizeWebsite("HTTPS://WWW.Example.com/path")).toBe("example.com");
    expect(normalizeWebsite("not a site")).toBeNull();
  });

  it("strips phone labels", () => {
    expect(normalizePhone("Tel: +44 20 7946 0321")).toBe("+442079460321");
    expect(normalizePhone("M. +33 6 12 34 56 78")).toBe("+33612345678");
  });
});

describe("parseQrPayload", () => {
  it("reads vCards, including folded lines and structured names", () => {
    const qr = parseQrPayload(
      "BEGIN:VCARD\r\nVERSION:3.0\r\nN:Rao;Ananya;;;\r\nORG:XYZ Technologies;Platform\r\nTITLE:Senior Software\r\n  Engineer\r\nEMAIL;TYPE=work:ANANYA@xyz.example\r\nTEL;TYPE=cell:+14155550123\r\nEND:VCARD",
    );
    expect(qr).toMatchObject({
      fullName: "Ananya Rao",
      company: "XYZ Technologies",
      title: "Senior Software Engineer",
      emails: ["ananya@xyz.example"],
      phones: ["+14155550123"],
    });
  });

  it("reads MECARDs and plain links", () => {
    expect(parseQrPayload("MECARD:N:Webb,Marcus;TEL:+14155550188;EMAIL:m@x.example;;")).toMatchObject({
      fullName: "Marcus Webb",
      phones: ["+14155550188"],
      emails: ["m@x.example"],
    });
    expect(parseQrPayload("https://www.linkedin.com/in/someone")).toMatchObject({ url: "https://www.linkedin.com/in/someone" });
    expect(parseQrPayload("hello")).toBeNull();
  });
});
