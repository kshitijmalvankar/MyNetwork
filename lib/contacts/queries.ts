import "server-only";
import { z } from "zod";
import { openField, openJson } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { fromBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";

export const PAGE_SIZE = 50;

export const contactFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  company: z.uuid().optional(),
  role: z.string().max(40).optional(),
  seniority: z.string().max(40).optional(),
  industry: z.string().max(80).optional(),
  country: z.string().regex(/^[A-Z]{2}$/).optional(),
  event: z.uuid().optional(),
  sort: z.enum(["recent", "name", "company", "contacted", "relevance"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
});

export type ContactFilters = z.infer<typeof contactFiltersSchema>;

/** Reads filters from URL search params, dropping anything invalid. */
export function parseContactFilters(params: Record<string, string | string[] | undefined>): ContactFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v));
  const out: ContactFilters = {};
  for (const [key, schema] of Object.entries(contactFiltersSchema.shape)) {
    const parsed = (schema as z.ZodType).safeParse(flat[key]);
    if (parsed.success && parsed.data !== undefined) (out as Record<string, unknown>)[key] = parsed.data;
  }
  return out;
}

export type ContactRow = {
  id: string;
  fullName: string;
  nameNative: string | null;
  title: string | null;
  roleFamily: string | null;
  seniority: string | null;
  city: string | null;
  country: string | null;
  companyId: string | null;
  companyName: string | null;
  industry: string | null;
  lastContactedAt: string | null;
  createdAt: string;
};

export async function searchContacts(filters: ContactFilters, { limit = PAGE_SIZE } = {}) {
  const supabase = await createClient();
  const page = filters.page ?? 1;
  const { data, error } = await supabase.rpc("search_contacts", {
    p_query: filters.q ?? undefined,
    p_company_id: filters.company ?? undefined,
    p_role_family: filters.role ?? undefined,
    p_seniority: filters.seniority ?? undefined,
    p_industry: filters.industry ?? undefined,
    p_country: filters.country ?? undefined,
    p_event_id: filters.event ?? undefined,
    p_sort: filters.sort ?? (filters.q ? "relevance" : "recent"),
    p_limit: limit,
    p_offset: (page - 1) * limit,
  });
  if (error) throw error;
  const rows: ContactRow[] = (data ?? []).map((r) => ({
    id: r.id,
    fullName: r.full_name,
    nameNative: r.name_native,
    title: r.title,
    roleFamily: r.role_family,
    seniority: r.seniority,
    city: r.city,
    country: r.country,
    companyId: r.company_id,
    companyName: r.company_name,
    industry: r.industry,
    lastContactedAt: r.last_contacted_at,
    createdAt: r.created_at,
  }));
  return { rows, total: Number(data?.[0]?.total_count ?? 0), page, pageSize: limit };
}

export type Facet = { value: string; label?: string; count: number };
export type Facets = Record<"roleFamilies" | "seniorities" | "industries" | "countries" | "companies" | "events", Facet[]>;

export async function getFacets(): Promise<Facets> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("contact_facets");
  if (error) throw error;
  return data as unknown as Facets;
}

// ---------------------------------------------------------------------------
// One contact, decrypted
// ---------------------------------------------------------------------------

export type TimelineItem =
  | { kind: "interaction"; id: string; type: string; at: string; event: { id: string; name: string } | null }
  | { kind: "note"; id: string; at: string; body: string; noteKind: string };

export type ContactDetail = {
  id: string;
  fullName: string;
  nameNative: string | null;
  title: string | null;
  titleNative: string | null;
  roleFamily: string | null;
  seniority: string | null;
  industry: string | null;
  industryOverride: string | null;
  company: { id: string; name: string; domain: string | null; industry: string | null } | null;
  website: string | null;
  city: string | null;
  country: string | null;
  emails: string[];
  phones: string[];
  address: string | null;
  pastPositions: { company: string | null; title: string | null; until: string }[];
  lastContactedAt: string | null;
  createdAt: string;
  images: { id: string; side: "front" | "back" }[];
  timeline: TimelineItem[];
  reminders: { id: string; dueAt: string; note: string | null; doneAt: string | null; source: string }[];
};

export async function getContactDetail(userId: string, contactId: string): Promise<ContactDetail | null> {
  if (!z.uuid().safeParse(contactId).success) return null;
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("contacts")
    .select(
      "id, full_name, name_native, title, title_native, role_family, seniority, industry_override, website, city, country, emails_enc, phones_enc, address_enc, past_positions, last_contacted_at, created_at, companies(id, name, domain, industry)",
    )
    .eq("id", contactId)
    .maybeSingle();
  if (!c) return null;

  const [{ data: images }, { data: interactions }, { data: notes }, { data: reminders }] = await Promise.all([
    supabase.from("card_images").select("id, side").eq("contact_id", contactId).order("side"),
    supabase
      .from("interactions")
      .select("id, type, occurred_at, events(id, name)")
      .eq("contact_id", contactId)
      .order("occurred_at", { ascending: false }),
    supabase.from("notes").select("id, kind, body_enc, created_at").eq("contact_id", contactId).order("created_at", { ascending: false }),
    supabase
      .from("reminders")
      .select("id, due_at, note_enc, done_at, source")
      .eq("contact_id", contactId)
      .order("due_at", { ascending: true }),
  ]);

  const dek = await getUserDataKey(userId);
  const ctx = (column: string) => ({ userId, table: "contacts", column, rowId: contactId });
  const company = c.companies as ContactDetail["company"];

  const timeline: TimelineItem[] = [
    ...(interactions ?? []).map((i) => ({
      kind: "interaction" as const,
      id: i.id,
      type: i.type,
      at: i.occurred_at,
      event: (i.events as { id: string; name: string } | null) ?? null,
    })),
    ...(notes ?? []).map((n) => ({
      kind: "note" as const,
      id: n.id,
      at: n.created_at,
      noteKind: n.kind,
      body: openField(dek, fromBytea(n.body_enc), { userId, table: "notes", column: "body_enc", rowId: n.id }).toString("utf8"),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return {
    id: c.id,
    fullName: c.full_name,
    nameNative: c.name_native,
    title: c.title,
    titleNative: c.title_native,
    roleFamily: c.role_family,
    seniority: c.seniority,
    industry: c.industry_override ?? company?.industry ?? null,
    industryOverride: c.industry_override,
    company,
    website: c.website,
    city: c.city,
    country: c.country,
    emails: c.emails_enc ? openJson<string[]>(dek, fromBytea(c.emails_enc), ctx("emails_enc")) : [],
    phones: c.phones_enc ? openJson<string[]>(dek, fromBytea(c.phones_enc), ctx("phones_enc")) : [],
    address: c.address_enc ? openField(dek, fromBytea(c.address_enc), ctx("address_enc")).toString("utf8") : null,
    pastPositions: (c.past_positions as ContactDetail["pastPositions"]) ?? [],
    lastContactedAt: c.last_contacted_at,
    createdAt: c.created_at,
    images: (images ?? []) as ContactDetail["images"],
    timeline,
    reminders: (reminders ?? []).map((r) => ({
      id: r.id,
      dueAt: r.due_at,
      doneAt: r.done_at,
      source: r.source,
      note: r.note_enc
        ? openField(dek, fromBytea(r.note_enc), { userId, table: "reminders", column: "note_enc", rowId: r.id }).toString("utf8")
        : null,
    })),
  };
}
