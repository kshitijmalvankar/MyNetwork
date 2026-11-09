import { describe, expect, it } from "vitest";
import { companyKey, findCompanyMatch, groupSameCompanies, sameCompany } from "@/lib/companies";

describe("companyKey", () => {
  it("drops legal suffixes, 'the' and trailing generic words", () => {
    expect(companyKey("XYZ Technologies Pvt. Ltd.")).toBe("xyz");
    expect(companyKey("The XYZ Tech Group")).toBe("xyz");
    expect(companyKey("Northwind Robotics Inc.")).toBe("northwind robotics");
  });

  it("keeps the full name when the core would be very short", () => {
    expect(companyKey("QX Tech")).toBe("qx tech");
    expect(companyKey("IBM")).toBe("ibm");
  });
});

describe("sameCompany", () => {
  it("matches spellings of one company", () => {
    expect(sameCompany({ name: "XYZ Tech" }, { name: "XYZ Technologies Pvt Ltd" })).toBe(true);
    expect(sameCompany({ name: "NorthWind Robotics" }, { name: "Northwind Robotics Pvt. Ltd." })).toBe(true);
    expect(sameCompany({ name: "Northwind", domain: "northwind.example" }, { name: "Northwind Robotics", domain: "northwind.example" })).toBe(true);
  });

  it("keeps different businesses apart", () => {
    expect(sameCompany({ name: "Northwind Robotics" }, { name: "Northwind Logistics" })).toBe(false);
    expect(sameCompany({ name: "Kestrel Capital" }, { name: "Kestrel Ventures" })).toBe(false);
    // Same core name, but different websites.
    expect(sameCompany({ name: "Nova Labs", domain: "novalabs.example" }, { name: "Nova Systems", domain: "novasystems.example" })).toBe(false);
    // Same domain but nothing in common in the name, as with a parent company's email.
    expect(sameCompany({ name: "Acme", domain: "group.example" }, { name: "Zenith Foods", domain: "group.example" })).toBe(false);
  });

  it("matches on the core name when only one side has a domain", () => {
    expect(sameCompany({ name: "Nova Labs", domain: "novalabs.example" }, { name: "Nova" })).toBe(true);
  });
});

describe("findCompanyMatch", () => {
  const existing = [
    { id: "1", name: "Orbit Fintech Technologies", domain: null },
    { id: "2", name: "Orbit Fintech", domain: "orbit.example" },
    { id: "3", name: "Helix Bio", domain: "helix.example" },
  ];

  it("prefers the same name, then the same domain", () => {
    expect(findCompanyMatch(existing, { name: "Orbit Fintech Ltd" })?.id).toBe("2");
    expect(findCompanyMatch(existing, { name: "Helix Biotech", domain: "helix.example" })?.id).toBe("3");
    expect(findCompanyMatch(existing, { name: "Quanta Legal" })).toBeUndefined();
  });
});

describe("groupSameCompanies", () => {
  it("never puts two different domains in one group", () => {
    const groups = groupSameCompanies([
      { name: "Nova Labs", domain: "novalabs.example" },
      { name: "Nova", domain: null },
      { name: "Nova Systems", domain: "novasystems.example" },
    ]);
    expect(groups.map((g) => g.map((c) => c.name).sort())).toEqual([["Nova", "Nova Labs"], ["Nova Systems"]]);
  });

  it("groups every spelling of one company", () => {
    const groups = groupSameCompanies([
      { name: "XYZ Tech", domain: "xyz.example" },
      { name: "Bluefin Analytics", domain: "bluefin.example" },
      { name: "XYZ Technologies Pvt Ltd", domain: null },
      { name: "The XYZ Group", domain: "xyz.example" },
    ]);
    expect(groups.map((g) => g.length).sort()).toEqual([1, 3]);
  });
});
