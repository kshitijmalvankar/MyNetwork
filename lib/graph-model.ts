// Turns the network into graph nodes and links. Pure and client-safe, so the
// view can rebuild instantly when toggles or filters change.
import type { GraphData } from "@/lib/graph";

export type Person = GraphData["people"][number];
export type NodeKind = "person" | "company" | "event";
export type LinkKind = "works" | "met" | "similar";

export type GraphNode = { id: string; kind: NodeKind; label: string; size: number; x?: number; y?: number };
export type GraphLink = { source: string; target: string; kind: LinkKind; score?: number };

export type GraphOptions = { companies: boolean; events: boolean; similar: boolean };
export type GraphFilters = { roleFamily?: string; seniority?: string; industry?: string; country?: string; query?: string };

/** Similar-background links drawn on the map: each person's closest few, above this score. */
export const SIMILAR_MIN = 0.62;
export const SIMILAR_PER_PERSON = 2;

export function buildGraph(data: GraphData, options: GraphOptions): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = data.people.map((p) => ({ id: p.id, kind: "person", label: p.name, size: 1 }));
  const links: GraphLink[] = [];

  if (options.companies) {
    const counts = new Map<string, number>();
    for (const p of data.people) if (p.companyId) counts.set(p.companyId, (counts.get(p.companyId) ?? 0) + 1);
    for (const c of data.companies) {
      const n = counts.get(c.id);
      if (n) nodes.push({ id: c.id, kind: "company", label: c.name, size: n });
    }
    for (const p of data.people) if (p.companyId && counts.has(p.companyId)) links.push({ source: p.id, target: p.companyId, kind: "works" });
  }

  if (options.events) {
    const counts = new Map<string, number>();
    for (const [, e] of data.metAt) counts.set(e, (counts.get(e) ?? 0) + 1);
    for (const e of data.events) {
      const n = counts.get(e.id);
      if (n) nodes.push({ id: e.id, kind: "event", label: e.name, size: n });
    }
    for (const [p, e] of data.metAt) if (counts.has(e)) links.push({ source: p, target: e, kind: "met" });
  }

  if (options.similar) {
    const seen = new Set<string>();
    const perPerson = new Map<string, number>();
    for (const [a, b, score] of [...data.similar].sort((x, y) => y[2] - x[2])) {
      if (score < SIMILAR_MIN || (perPerson.get(a) ?? 0) >= SIMILAR_PER_PERSON) continue;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      perPerson.set(a, (perPerson.get(a) ?? 0) + 1);
      links.push({ source: a, target: b, kind: "similar", score });
    }
  }

  return { nodes, links };
}

const hasFilter = (f: GraphFilters) => Boolean(f.roleFamily || f.seniority || f.industry || f.country || f.query?.trim());

/** People matching every active filter, or null when no filter is set (nothing is dimmed). */
export function matchingPeople(people: Person[], f: GraphFilters, companyName: (id: string) => string | undefined): Set<string> | null {
  if (!hasFilter(f)) return null;
  const q = f.query?.trim().toLowerCase();
  return new Set(
    people
      .filter(
        (p) =>
          (!f.roleFamily || p.roleFamily === f.roleFamily) &&
          (!f.seniority || p.seniority === f.seniority) &&
          (!f.industry || p.industry === f.industry) &&
          (!f.country || p.country === f.country) &&
          (!q || [p.name, p.title, p.companyId ? companyName(p.companyId) : null, p.city].some((v) => v?.toLowerCase().includes(q))),
      )
      .map((p) => p.id),
  );
}

/** Each node's direct neighbours, for highlighting a selection. */
export function neighbours(links: GraphLink[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const add = (a: string, b: string) => (map.get(a) ?? map.set(a, new Set()).get(a)!).add(b);
  for (const l of links) {
    const s = typeof l.source === "string" ? l.source : (l.source as { id: string }).id;
    const t = typeof l.target === "string" ? l.target : (l.target as { id: string }).id;
    add(s, t);
    add(t, s);
  }
  return map;
}

/** Closest matches for one person, best first, with what they have in common. */
export function similarTo(data: GraphData, personId: string, limit = 5) {
  const byId = new Map(data.people.map((p) => [p.id, p]));
  const me = byId.get(personId);
  if (!me) return [];
  const scores = new Map<string, number>();
  for (const [a, b, score] of data.similar) {
    const other = a === personId ? b : b === personId ? a : null;
    if (other && score > (scores.get(other) ?? 0)) scores.set(other, score);
  }
  return [...scores]
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .flatMap(([id, score]) => {
      const p = byId.get(id);
      if (!p) return [];
      const shared = [
        p.roleFamily && p.roleFamily === me.roleFamily && `${p.roleFamily}`,
        p.industry && p.industry === me.industry && p.industry,
        p.seniority && p.seniority === me.seniority && p.seniority,
        p.city && p.city === me.city && p.city,
      ].filter((s): s is string => Boolean(s));
      return [{ person: p, score, shared }];
    });
}
