import { describe, expect, it } from "vitest";
import type { GraphData } from "@/lib/graph";
import { buildGraph, matchingPeople, neighbours, similarTo } from "./graph-model";

const person = (id: string, extra: Partial<GraphData["people"][number]> = {}) => ({
  id,
  name: `Person ${id}`,
  title: null,
  companyId: null,
  roleFamily: null,
  seniority: null,
  industry: null,
  city: null,
  country: null,
  lastContact: "2026-10-01T00:00:00Z",
  ...extra,
});

const data: GraphData = {
  people: [
    person("a", { companyId: "acme", roleFamily: "Engineering", industry: "Robotics", title: "Engineer" }),
    person("b", { companyId: "acme", roleFamily: "Sales" }),
    person("c", { companyId: "globex", roleFamily: "Engineering", industry: "Robotics", city: "Berlin" }),
    person("d", { roleFamily: "Engineering" }),
  ],
  companies: [
    { id: "acme", name: "Acme", industry: "Robotics" },
    { id: "globex", name: "Globex", industry: null },
    { id: "empty", name: "Nobody here", industry: null },
  ],
  events: [{ id: "expo", name: "Expo", date: "2026-09-01", location: null }],
  metAt: [
    ["a", "expo"],
    ["c", "expo"],
  ],
  similar: [
    ["a", "c", 0.8],
    ["c", "a", 0.8],
    ["a", "d", 0.7],
    ["a", "b", 0.65],
    ["d", "b", 0.5],
  ],
  truncated: false,
};

describe("buildGraph", () => {
  it("links people to their companies and events, skipping empty hubs", () => {
    const g = buildGraph(data, { companies: true, events: true, similar: false });
    expect(g.nodes.map((n) => n.id).sort()).toEqual(["a", "acme", "b", "c", "d", "expo", "globex"]);
    expect(g.nodes.find((n) => n.id === "acme")?.size).toBe(2);
    expect(g.links.filter((l) => l.kind === "works")).toHaveLength(3);
    expect(g.links.filter((l) => l.kind === "met")).toHaveLength(2);
  });

  it("draws each person's strongest similar links once, above the threshold", () => {
    const g = buildGraph(data, { companies: false, events: false, similar: true });
    const similar = g.links.filter((l) => l.kind === "similar").map((l) => `${l.source}-${l.target}`);
    // a keeps its two best (c, d); the reverse c→a is a duplicate; d→b is below the threshold.
    expect(similar).toEqual(["a-c", "a-d"]);
    expect(g.nodes.every((n) => n.kind === "person")).toBe(true);
  });
});

describe("filters and neighbours", () => {
  const name = (id: string) => data.companies.find((c) => c.id === id)?.name;

  it("returns null when nothing is filtered, so nothing is dimmed", () => {
    expect(matchingPeople(data.people, {}, name)).toBeNull();
    expect(matchingPeople(data.people, { query: "  " }, name)).toBeNull();
  });

  it("combines filters and searches names, titles, companies and cities", () => {
    expect([...matchingPeople(data.people, { roleFamily: "Engineering", industry: "Robotics" }, name)!].sort()).toEqual(["a", "c"]);
    expect([...matchingPeople(data.people, { query: "globex" }, name)!]).toEqual(["c"]);
    expect([...matchingPeople(data.people, { query: "berlin" }, name)!]).toEqual(["c"]);
  });

  it("finds direct neighbours in both directions", () => {
    const n = neighbours(buildGraph(data, { companies: true, events: false, similar: false }).links);
    expect([...n.get("acme")!].sort()).toEqual(["a", "b"]);
    expect([...n.get("a")!]).toEqual(["acme"]);
  });

  it("explains what similar people have in common", () => {
    const matches = similarTo(data, "a");
    expect(matches.map((m) => m.person.id)).toEqual(["c", "d", "b"]);
    expect(matches[0].shared).toEqual(["Engineering", "Robotics"]);
  });
});
