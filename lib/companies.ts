// Deciding when two spellings are the same company, so people from "XYZ Tech"
// and "XYZ Technologies Pvt Ltd" end up together. Pure, so the save path, the
// tidy command and the test network all use exactly the same rules.
import { normalizeCompanyName } from "@/lib/ai/validate";

export type CompanyLike = { name: string; domain?: string | null };

/** Trailing words that don't tell two companies apart. */
const GENERIC = new Set([
  "technologies",
  "technology",
  "tech",
  "solutions",
  "solution",
  "systems",
  "system",
  "labs",
  "lab",
  "group",
  "holdings",
  "holding",
  "international",
  "intl",
  "global",
  "software",
  "services",
  "company",
]);

/** The name without "the" and trailing generic words: "The XYZ Technologies Group" → "xyz". */
export function companyKey(name: string): string {
  const full = normalizeCompanyName(name);
  const words = full.replace(/^the /, "").split(" ").filter(Boolean);
  while (words.length > 1 && GENERIC.has(words[words.length - 1])) words.pop();
  const key = words.join(" ");
  // A one- or two-letter core ("qx" from "QX Tech") could be many different companies.
  return key.length >= 3 ? key : full;
}

const domainOf = (c: CompanyLike) => c.domain?.trim().toLowerCase().replace(/^www\./, "") || null;

function sharesWord(a: string, b: string) {
  const words = new Set(a.split(" ").filter((w) => w.length >= 3 && !GENERIC.has(w)));
  return b.split(" ").some((w) => words.has(w));
}

/**
 * Two companies are the same if their names match once legal suffixes are
 * dropped, if they share a website or work email domain and a word of their
 * name, or if their names match without generic words like "Technologies".
 * The last only counts when they don't have different domains.
 */
export function sameCompany(a: CompanyLike, b: CompanyLike): boolean {
  const na = normalizeCompanyName(a.name);
  const nb = normalizeCompanyName(b.name);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const da = domainOf(a);
  const db = domainOf(b);
  if (da && db) return da === db && sharesWord(na, nb);
  return companyKey(a.name) === companyKey(b.name);
}

/** The best existing match for a company: same name first, then same domain, then same core name. */
export function findCompanyMatch<T extends CompanyLike>(existing: T[], company: CompanyLike): T | undefined {
  const normalized = normalizeCompanyName(company.name);
  const domain = domainOf(company);
  const matches = existing.filter((e) => sameCompany(e, company));
  return (
    matches.find((e) => normalizeCompanyName(e.name) === normalized) ??
    (domain ? matches.find((e) => domainOf(e) === domain) : undefined) ??
    matches[0]
  );
}

/**
 * Groups records that are the same company. A group never ends up with two
 * different domains, even through a third record that matches both.
 */
export function groupSameCompanies<T extends CompanyLike>(companies: T[]): T[][] {
  const parent = companies.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const domains = companies.map((c) => new Set(domainOf(c) ? [domainOf(c)!] : []));

  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      const a = find(i);
      const b = find(j);
      if (a === b || !sameCompany(companies[i], companies[j])) continue;
      const merged = new Set([...domains[a], ...domains[b]]);
      if (merged.size > 1) continue;
      parent[b] = a;
      domains[a] = merged;
    }
  }

  const groups = new Map<number, T[]>();
  companies.forEach((c, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), c]));
  return [...groups.values()];
}
