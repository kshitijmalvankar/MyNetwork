// Loads a fictional network into one account, replacing that account's
// contacts, companies, events and chats, then indexes it for Ask. The small one
// in fixtures/network.json is used by the end-to-end tests and the Ask eval;
// the large one (./large-network.ts) by `pnpm seed:network --large`.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalizeCompanyName, normalizePhone } from "@/lib/ai/validate";
import { findCompanyMatch } from "@/lib/companies";
import { blindIndex, normalizeEmail } from "@/lib/crypto/blind-index";
import { sealField, sealJson } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { canonicalIndustry } from "@/lib/industries";
import { indexStale } from "@/lib/knowledge/indexer";
import { removeFiles } from "@/lib/storage";
import { adminClient } from "@/lib/supabase/admin";
import { toBytea } from "@/lib/supabase/bytea";

export type Fixture = {
  events: { key: string; name: string; startsOn: string; location: string; description: string }[];
  contacts: {
    name: string;
    title: string;
    company: string | null;
    industry: string;
    role: string;
    seniority: string;
    city: string;
    country: string;
    /** Empty for a card without one. */
    email: string;
    phone?: string;
    /** [event key or interaction type, date] */
    met: [string, string][];
    notes?: string[];
    reminder?: [string, string];
    pastPositions?: { company: string; title: string; until: string }[];
    /** Who knows whom, by the other person's name. "introduced_by": they introduced the user to this person. */
    links?: { to: string; kind: "knows" | "introduced_by" }[];
  }[];
};

export const smallNetwork = () => JSON.parse(readFileSync("fixtures/network.json", "utf8")) as Fixture;

export const TEST_DOMAIN = /@example\.(com|org|net)$/i;

/** The account for the large network: the test account's address with "+network" added. */
export const largeNetworkEmail = (testEmail: string) => testEmail.replace("@", "+network@");
const INTERACTION_TYPES = new Set(["met", "email", "call", "meeting", "message"]);

/** The day the fixture's dates were written relative to (the Ask eval's "today"). */
const FIXTURE_TODAY = "2026-10-21";

/** Days from the fixture's "today" to the real one, to make the network look the same age on any day. */
export function daysSinceFixture(now = new Date()) {
  return Math.round((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.parse(`${FIXTURE_TODAY}T00:00:00Z`)) / 86_400_000);
}

function shiftDay(day: string, days: number) {
  if (!days) return day;
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Finds an account on a reserved example domain. Never returns any other account. */
export async function findTestAccount(email: string): Promise<string | undefined> {
  if (!TEST_DOMAIN.test(email)) throw new Error("Test accounts must use a reserved example domain (example.com/org/net).");
  const db = adminClient();
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((u) => u.email === email.toLowerCase());
    if (user) return user.id;
    if (data.users.length < 200) return undefined;
  }
}

/** Inserts rows a batch at a time; one request per row is too slow for hundreds of people. */
async function insertAll(
  table: "events" | "companies" | "contacts" | "contact_identifiers" | "interactions" | "notes" | "reminders" | "contact_links",
  rows: object[],
) {
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await adminClient()
      .from(table)
      .insert(rows.slice(i, i + 250) as never);
    if (error) throw error;
  }
}

/**
 * Seeds a network into `userId`. With `shiftDays`, every date moves by that
 * many days, so "met last month" and overdue follow-ups stay true over time.
 * Companies go through the same matching as saved cards, so different
 * spellings of one company end up as one.
 */
export async function seedNetwork(userId: string, { shiftDays = 0, fixture = smallNetwork() }: { shiftDays?: number; fixture?: Fixture } = {}) {
  const db = adminClient();
  const day = (d: string) => shiftDay(d, shiftDays);

  // Clear the account's network first, so seeding twice gives the same result.
  const { data: images } = await db.from("card_images").select("path, thumb_path").eq("user_id", userId);
  await removeFiles(userId, (images ?? []).flatMap((i) => [i.path, i.thumb_path]));
  for (const table of ["chat_threads", "contacts", "companies", "events"] as const) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }

  const dek = await getUserDataKey(userId);
  const seal = (table: string, column: string, rowId: string, value: string) => toBytea(sealField(dek, value, { userId, table, column, rowId }));

  const eventIds = new Map(fixture.events.map((e) => [e.key, randomUUID()]));
  await insertAll(
    "events",
    fixture.events.map((e) => {
      const id = eventIds.get(e.key)!;
      return { id, user_id: userId, name: e.name, starts_on: day(e.startsOn), location: e.location, description_enc: seal("events", "description_enc", id, e.description) };
    }),
  );

  const companies: { id: string; user_id: string; name: string; normalized_name: string; domain: string | null; industry: string | null }[] = [];
  const contacts: object[] = [];
  const identifiers: object[] = [];
  const interactions: object[] = [];
  const notes: object[] = [];
  const reminders: object[] = [];

  for (const c of fixture.contacts) {
    const domain = c.email.split("@")[1] || null;
    const industry = canonicalIndustry(c.industry) ?? c.industry;
    let companyId: string | null = null;
    if (c.company) {
      const match = findCompanyMatch(companies, { name: c.company, domain });
      if (match) {
        match.domain ??= domain;
        companyId = match.id;
      } else {
        companyId = randomUUID();
        companies.push({ id: companyId, user_id: userId, name: c.company, normalized_name: normalizeCompanyName(c.company), domain, industry });
      }
    }

    const contactId = randomUUID();
    const emails = c.email ? [normalizeEmail(c.email)] : [];
    const phones = c.phone ? [normalizePhone(c.phone, "US") ?? c.phone] : [];
    const ctx = (column: string) => ({ userId, table: "contacts", column, rowId: contactId });
    contacts.push({
      id: contactId,
      user_id: userId,
      full_name: c.name,
      title: c.title,
      company_id: companyId,
      industry_override: c.company ? null : industry,
      role_family: c.role,
      seniority: c.seniority,
      city: c.city,
      country: c.country,
      emails_enc: emails.length ? toBytea(sealJson(dek, emails, ctx("emails_enc"))) : null,
      phones_enc: phones.length ? toBytea(sealJson(dek, phones, ctx("phones_enc"))) : null,
      past_positions: (c.pastPositions ?? []).map((p) => ({ ...p, until: day(p.until) })),
      created_at: `${day(c.met[0][1])}T10:00:00Z`,
    });
    identifiers.push(
      ...emails.map((e) => ({ user_id: userId, contact_id: contactId, kind: "email", blind_index: blindIndex(userId, "email", e) })),
      ...phones.map((p) => ({ user_id: userId, contact_id: contactId, kind: "phone", blind_index: blindIndex(userId, "phone", p) })),
    );
    for (const [what, on] of c.met) {
      const isType = INTERACTION_TYPES.has(what);
      interactions.push({ user_id: userId, contact_id: contactId, type: isType ? what : "met", event_id: isType ? null : eventIds.get(what), occurred_at: `${day(on)}T10:00:00Z` });
    }
    for (const body of c.notes ?? []) {
      const id = randomUUID();
      notes.push({ id, user_id: userId, contact_id: contactId, body_enc: seal("notes", "body_enc", id, body), created_at: `${day(c.met[0][1])}T18:00:00Z` });
    }
    if (c.reminder) {
      const id = randomUUID();
      reminders.push({ id, user_id: userId, contact_id: contactId, due_at: `${day(c.reminder[0])}T09:00:00Z`, note_enc: seal("reminders", "note_enc", id, c.reminder[1]) });
    }
  }

  // Stated links, once everyone has an id. "Knows" is stored once, smaller id first.
  const idOf = new Map(contacts.map((c) => [(c as { full_name: string }).full_name, (c as { id: string }).id]));
  const links = new Map<string, object>();
  for (const c of fixture.contacts) {
    for (const l of c.links ?? []) {
      const [me, other] = [idOf.get(c.name), idOf.get(l.to)];
      if (!me || !other || me === other) continue;
      const [from, to] = l.kind === "knows" ? [me, other].sort() : [me, other];
      links.set(`${from}:${to}:${l.kind}`, { user_id: userId, contact_id: from, other_id: to, kind: l.kind });
    }
  }

  await insertAll("companies", companies);
  await insertAll("contacts", contacts);
  await insertAll("contact_identifiers", identifiers);
  await insertAll("interactions", interactions);
  await insertAll("notes", notes);
  await insertAll("reminders", reminders);
  await insertAll("contact_links", [...links.values()]);

  let indexed = 0;
  let failed = 0;
  // Failed items stay flagged, so stop once a round makes no progress.
  for (let round = 0; round < 50; round++) {
    const result = await indexStale({ userId, limit: 100, concurrency: 8 });
    indexed += result.indexed;
    failed = result.failed;
    if (result.indexed === 0) break;
  }
  return { contacts: fixture.contacts.length, companies: companies.length, events: fixture.events.length, indexed, failed };
}
