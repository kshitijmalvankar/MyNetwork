import { describe, expect, it } from "vitest";
import { MAX_CHUNK_CHARS, backgroundText, contactHeadline, countryName, eventText, noteChunks, profileText, splitText } from "./text";

describe("profileText", () => {
  it("describes a contact with everything known about them", () => {
    const text = profileText({
      fullName: "Priya Shah",
      nameNative: "प्रिया शाह",
      title: "Senior Product Manager",
      company: "Acme Robotics",
      industry: "Robotics",
      roleFamily: "Product",
      seniority: "Senior",
      city: "Mumbai",
      country: "IN",
      website: "acme.example",
      pastPositions: [{ company: "Globex", title: "Engineer", until: "2025-03-01" }],
      meetings: [{ type: "met", on: "2026-10-12", event: "TechSummit", location: "Mumbai" }],
      reminders: [{ due: "2026-11-01", note: "Send the deck" }],
    });
    expect(text).toBe(
      [
        "Priya Shah (प्रिया शाह)",
        "Senior Product Manager at Acme Robotics",
        "Industry: Robotics · Role: Product · Seniority: Senior",
        "Location: Mumbai, India",
        "Website: acme.example",
        "Previously: Engineer at Globex (until 2025-03-01)",
        "History: Met at TechSummit in Mumbai on 2026-10-12",
        "Follow-up due 2026-11-01: Send the deck",
      ].join("\n"),
    );
  });

  it("leaves out what isn't known", () => {
    expect(profileText({ fullName: "Sam Lee" })).toBe("Sam Lee");
    expect(profileText({ fullName: "Sam Lee", nameNative: "Sam Lee", country: "JP" })).toBe("Sam Lee\nLocation: Japan");
  });
});

describe("helpers", () => {
  it("builds a headline", () => {
    expect(contactHeadline({ fullName: "A", title: "CTO", company: "B" })).toBe("A (CTO at B)");
    expect(contactHeadline({ fullName: "A", company: "B" })).toBe("A (at B)");
    expect(contactHeadline({ fullName: "A" })).toBe("A");
  });

  it("names countries and tolerates bad codes", () => {
    expect(countryName("DE")).toBe("Germany");
    expect(countryName(null)).toBeNull();
    expect(countryName("not-a-code")).toBe("not-a-code");
  });

  it("describes events", () => {
    expect(eventText({ name: "Expo", startsOn: "2026-01-02", location: null, description: "Hardware" })).toBe(
      "Event: Expo\nDate: 2026-01-02\nAbout: Hardware",
    );
  });
});

describe("splitText", () => {
  it("keeps short text whole and drops empty text", () => {
    expect(splitText("  hello  ")).toEqual(["hello"]);
    expect(splitText("   ")).toEqual([]);
  });

  it("splits long text into pieces under the limit without losing words", () => {
    const sentence = "Discussed the warehouse robotics pilot and pricing. ";
    const para = sentence.repeat(20).trim();
    const text = `${para}\n\n${para}\n\n${"x".repeat(3000)}`;
    const pieces = splitText(text, 300);
    expect(pieces.length).toBeGreaterThan(5);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(300);
    const words = (s: string) => s.split(/\s+/).filter((w) => !w.startsWith("x"));
    expect(pieces.flatMap(words)).toEqual(words(text));
  });

  it("prefixes every note piece with who it is about", () => {
    const chunks = noteChunks("Priya Shah (CTO at Acme)", "2026-10-12", "word ".repeat(600));
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.startsWith("Note about Priya Shah (CTO at Acme), written 2026-10-12:\n")).toBe(true);
      expect(c.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    }
  });
});

describe("backgroundText", () => {
  it("describes the role without company, place or events", () => {
    expect(
      backgroundText({
        title: "Data Scientist",
        roleFamily: "Data",
        seniority: "Mid",
        industry: "Fintech",
        pastPositions: [{ company: "Globex", title: "Analyst", until: "2024-01-01" }],
      }),
    ).toBe("Data Scientist. Data role, Mid level. Industry: Fintech. Previously: Analyst");
  });

  it("is empty when nothing is known about the role", () => {
    expect(backgroundText({})).toBeNull();
  });
});
