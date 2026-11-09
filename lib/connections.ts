// How two people are connected, worked out from what's already stored (the
// same company now or in the past) plus the links the user stated. Pure and
// client-safe, so the profile, the graph and later Ask all agree.
import { normalizeCompanyName } from "@/lib/ai/validate";
import { companyKey } from "@/lib/companies";

export type PastJob = { company: string | null; title: string | null; until: string | null };
export type StatedLink = { id: string; contactId: string; otherId: string; kind: "knows" | "introduced_by"; source: "user" | "ai" };

type Company = { id: string; name: string };
export type Employer = { id: string; name: string };

/**
 * Finds the company a past job was at. A past job has no domain, so it matches
 * one of the user's companies by name, the same way a card without an email
 * would. A company nobody works at now gets an id from its name.
 */
export function employerResolver(companies: Company[]) {
  const byName = new Map<string, Company>();
  const byKey = new Map<string, Company>();
  for (const c of companies) {
    const name = normalizeCompanyName(c.name);
    if (!byName.has(name)) byName.set(name, c);
    const key = companyKey(c.name);
    if (!byKey.has(key)) byKey.set(key, c);
  }
  return (name: string | null): Employer | null => {
    const normalized = name ? normalizeCompanyName(name) : "";
    if (!normalized) return null;
    const company = byName.get(normalized) ?? byKey.get(companyKey(name!));
    return company ? { id: company.id, name: company.name } : { id: `past:${companyKey(name!)}`, name: name!.trim() };
  };
}

export type WorkedTogether = {
  a: string;
  b: string;
  companyId: string;
  company: string;
  /** Both used to work there, or `formerly` used to work where `now` works today. */
  how: { kind: "both_past" } | { kind: "past_current"; formerly: string; now: string };
};

/** People who worked at the same company, at least one of them in the past. */
export function formerColleagues(people: { id: string; companyId: string | null; pastCompanies: (string | null)[] }[], companies: Company[]): WorkedTogether[] {
  const resolve = employerResolver(companies);
  const names = new Map(companies.map((c) => [c.id, c.name]));
  const groups = new Map<string, { name: string; current: string[]; past: string[] }>();
  const group = (id: string, name: string) => groups.get(id) ?? groups.set(id, { name, current: [], past: [] }).get(id)!;

  for (const p of people) {
    if (p.companyId) group(p.companyId, names.get(p.companyId) ?? "").current.push(p.id);
    const seen = new Set<string>();
    for (const name of p.pastCompanies) {
      const employer = resolve(name);
      // A past job at the company they're at now isn't a former employer.
      if (!employer || employer.id === p.companyId || seen.has(employer.id)) continue;
      seen.add(employer.id);
      group(employer.id, employer.name).past.push(p.id);
    }
  }

  const out: WorkedTogether[] = [];
  const done = new Set<string>();
  const add = (x: string, y: string, companyId: string, company: string, how: WorkedTogether["how"]) => {
    const [a, b] = x < y ? [x, y] : [y, x];
    if (a === b || done.has(`${a}:${b}`)) return;
    done.add(`${a}:${b}`);
    out.push({ a, b, companyId, company, how });
  };
  for (const [id, g] of groups) {
    for (const formerly of g.past) for (const now of g.current) add(formerly, now, id, g.name, { kind: "past_current", formerly, now });
    for (let i = 0; i < g.past.length; i++) for (let j = i + 1; j < g.past.length; j++) add(g.past[i], g.past[j], id, g.name, { kind: "both_past" });
  }
  return out;
}

/** How a link reads from one person's side: "Introduced you to Ana" or "Introduced by Ana" or "Knows Ana". */
export function statedFrom(link: StatedLink, personId: string): { otherId: string; label: "Knows" | "Introduced by" | "Introduced you to" } {
  const otherId = link.contactId === personId ? link.otherId : link.contactId;
  if (link.kind === "knows") return { otherId, label: "Knows" };
  return { otherId, label: link.contactId === personId ? "Introduced by" : "Introduced you to" };
}

/** A past job's end, which is a full date when recorded automatically and a month when typed in. */
export function untilLabel(until: string | null | undefined) {
  if (!until) return null;
  const date = new Date(`${until.length === 7 ? `${until}-01` : until}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en", until.length === 7 ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
