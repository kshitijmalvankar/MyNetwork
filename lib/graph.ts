import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PastJob, StatedLink } from "@/lib/connections";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

/** Everything the graph draws, kept compact: only plaintext fields, no contact details. */
export type GraphData = {
  people: {
    id: string;
    name: string;
    title: string | null;
    companyId: string | null;
    roleFamily: string | null;
    seniority: string | null;
    industry: string | null;
    city: string | null;
    country: string | null;
    lastContact: string;
    /** Companies from their past jobs, as written. */
    pastCompanies: string[];
  }[];
  companies: { id: string; name: string; industry: string | null }[];
  events: { id: string; name: string; date: string | null; location: string | null }[];
  /** [personId, eventId] */
  metAt: [string, string][];
  /** [personId, similarPersonId, score] */
  similar: [string, string, number][];
  /** Who knows whom, as the user stated it. */
  links: StatedLink[];
  truncated: boolean;
};

export const MAX_GRAPH_PEOPLE = 3000;
const PAGE = 1000;

/** Supabase returns at most 1,000 rows per request; this pages through up to `cap`. */
async function all<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, cap: number) {
  const rows: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await fetchPage(from, Math.min(from + PAGE, cap) - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

export async function getGraphData(supabase: Supabase): Promise<GraphData> {
  const [contacts, companies, events, interactions, similarity, stated] = await Promise.all([
    all(
      (from, to) =>
        supabase
          .from("contacts")
          .select("id, full_name, title, company_id, role_family, seniority, industry_override, city, country, last_contacted_at, created_at, past_positions")
          .order("created_at", { ascending: false })
          .range(from, to),
      MAX_GRAPH_PEOPLE + 1,
    ),
    all((from, to) => supabase.from("companies").select("id, name, industry").order("name").range(from, to), 5000),
    all((from, to) => supabase.from("events").select("id, name, starts_on, location").order("starts_on", { ascending: false }).range(from, to), 2000),
    all(
      (from, to) => supabase.from("interactions").select("contact_id, event_id").not("event_id", "is", null).range(from, to),
      20000,
    ),
    all((from, to) => supabase.from("contact_similarity").select("contact_id, similar_id, score").range(from, to), 20000),
    all((from, to) => supabase.from("contact_links").select("id, contact_id, other_id, kind, source").range(from, to), 20000),
  ]);

  const people = contacts.slice(0, MAX_GRAPH_PEOPLE);
  const ids = new Set(people.map((c) => c.id));
  const industryOf = new Map(companies.map((c) => [c.id, c.industry]));
  const metAt = new Map<string, [string, string]>();
  for (const i of interactions) if (ids.has(i.contact_id) && i.event_id) metAt.set(`${i.contact_id}:${i.event_id}`, [i.contact_id, i.event_id]);

  return {
    people: people.map((c) => ({
      id: c.id,
      name: c.full_name,
      title: c.title,
      companyId: c.company_id,
      roleFamily: c.role_family,
      seniority: c.seniority,
      industry: c.industry_override ?? (c.company_id ? (industryOf.get(c.company_id) ?? null) : null),
      city: c.city,
      country: c.country,
      lastContact: c.last_contacted_at ?? c.created_at,
      pastCompanies: (Array.isArray(c.past_positions) ? (c.past_positions as PastJob[]) : []).flatMap((j) => (j.company?.trim() ? [j.company.trim()] : [])),
    })),
    companies: companies.map((c) => ({ id: c.id, name: c.name, industry: c.industry })),
    events: events.map((e) => ({ id: e.id, name: e.name, date: e.starts_on, location: e.location })),
    metAt: [...metAt.values()],
    similar: similarity.filter((s) => ids.has(s.contact_id) && ids.has(s.similar_id)).map((s) => [s.contact_id, s.similar_id, Math.round(s.score * 1000) / 1000]),
    links: stated
      .filter((l) => ids.has(l.contact_id) && ids.has(l.other_id))
      .map((l) => ({ id: l.id, contactId: l.contact_id, otherId: l.other_id, kind: l.kind as StatedLink["kind"], source: l.source as StatedLink["source"] })),
    truncated: contacts.length > MAX_GRAPH_PEOPLE,
  };
}
