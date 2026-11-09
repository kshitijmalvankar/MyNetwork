import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { employerResolver, formerColleagues, statedFrom, type PastJob, type StatedLink } from "@/lib/connections";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

export type ConnectedPerson = { id: string; name: string; subtitle: string | null };
export type ProfileConnections = {
  /** Links the user stated, with how they read from the other person's side. */
  stated: { linkId: string; source: "user" | "ai"; person: ConnectedPerson; caption: string }[];
  workedTogether: { person: ConnectedPerson; caption: string }[];
  colleagues: ConnectedPerson[];
  colleaguesTotal: number;
  company: { id: string; name: string } | null;
};

const COLUMNS = "id, full_name, title, company_id, past_positions, companies(name)";
type Row = { id: string; full_name: string; title: string | null; company_id: string | null; past_positions: unknown; companies: { name: string } | null };

const toPerson = (r: Row): ConnectedPerson => ({ id: r.id, name: r.full_name, subtitle: [r.title, r.companies?.name].filter(Boolean).join(" · ") || null });
const pastJobs = (r: Row) => (Array.isArray(r.past_positions) ? (r.past_positions as PastJob[]) : []);
const none = <T>() => Promise.resolve({ data: [] as T[], count: 0 });

/** Everyone one person is connected to, for their profile. Row-level security limits every read to the user's own data. */
export async function loadConnections(supabase: Supabase, contactId: string): Promise<ProfileConnections> {
  const empty: ProfileConnections = { stated: [], workedTogether: [], colleagues: [], colleaguesTotal: 0, company: null };
  // The id goes into a filter string below, so it must be a plain UUID.
  if (!z.uuid().safeParse(contactId).success) return empty;

  const [{ data: me }, { data: links }, { data: companies }, { data: withPastJobs }] = await Promise.all([
    supabase.from("contacts").select(COLUMNS).eq("id", contactId).maybeSingle<Row>(),
    supabase.from("contact_links").select("id, contact_id, other_id, kind, source").or(`contact_id.eq.${contactId},other_id.eq.${contactId}`),
    supabase.from("companies").select("id, name").range(0, 4999),
    // Usually a small share of the network, so loading them all beats matching company names in SQL.
    supabase.from("contacts").select(COLUMNS).neq("past_positions", "[]").range(0, 4999).returns<Row[]>(),
  ]);
  if (!me) return empty;

  const resolve = employerResolver(companies ?? []);
  const pastEmployers = [...new Set(pastJobs(me).flatMap((j) => resolve(j.company)?.id ?? []))].filter((id) => !id.startsWith("past:"));
  const stated: StatedLink[] = (links ?? []).map((l) => ({ id: l.id, contactId: l.contact_id, otherId: l.other_id, kind: l.kind as StatedLink["kind"], source: l.source as StatedLink["source"] }));
  const linkedIds = [...new Set(stated.map((l) => statedFrom(l, contactId).otherId))];

  const [{ data: atPastEmployers }, { data: colleagues, count }, { data: linked }] = await Promise.all([
    pastEmployers.length ? supabase.from("contacts").select(COLUMNS).in("company_id", pastEmployers).limit(500).returns<Row[]>() : none<Row>(),
    me.company_id
      ? supabase.from("contacts").select(COLUMNS, { count: "exact" }).eq("company_id", me.company_id).neq("id", contactId).order("full_name").limit(6).returns<Row[]>()
      : none<Row>(),
    linkedIds.length ? supabase.from("contacts").select(COLUMNS).in("id", linkedIds).returns<Row[]>() : none<Row>(),
  ]);

  const first = me.full_name.split(/\s+/)[0];
  const byId = new Map([me, ...(withPastJobs ?? []), ...(atPastEmployers ?? []), ...(linked ?? [])].map((r) => [r.id, r]));

  const order = { "Introduced by": 0, "Introduced you to": 1, Knows: 2 };
  const statedRows = stated
    .map((l) => ({ link: l, ...statedFrom(l, contactId) }))
    .filter((s) => byId.has(s.otherId))
    .sort((a, b) => order[a.label] - order[b.label] || byId.get(a.otherId)!.full_name.localeCompare(byId.get(b.otherId)!.full_name))
    .map((s) => {
      const other = byId.get(s.otherId)!;
      const otherFirst = other.full_name.split(/\s+/)[0];
      return {
        linkId: s.link.id,
        source: s.link.source,
        person: toPerson(other),
        caption: s.label === "Knows" ? `Knows ${first}` : s.label === "Introduced by" ? `Introduced you to ${first}` : `${first} introduced you to ${otherFirst}`,
      };
    });

  const pairs = formerColleagues(
    [...byId.values()].map((r) => ({ id: r.id, companyId: r.company_id, pastCompanies: pastJobs(r).map((j) => j.company) })),
    companies ?? [],
  ).filter((p) => p.a === contactId || p.b === contactId);
  const workedTogether = pairs
    .map((p) => {
      const other = byId.get(p.a === contactId ? p.b : p.a)!;
      const caption =
        p.how.kind === "both_past"
          ? `Both used to work at ${p.company}`
          : p.how.formerly === contactId
            ? `Now at ${p.company}, where ${first} used to work`
            : `Used to work at ${p.company}`;
      return { person: toPerson(other), caption };
    })
    .sort((a, b) => a.person.name.localeCompare(b.person.name));

  return {
    stated: statedRows,
    workedTogether,
    colleagues: (colleagues ?? []).map(toPerson),
    colleaguesTotal: count ?? 0,
    company: me.company_id && me.companies ? { id: me.company_id, name: me.companies.name } : null,
  };
}
