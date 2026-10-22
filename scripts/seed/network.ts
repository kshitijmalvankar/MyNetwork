// Loads the fictional network in fixtures/network.json into one account,
// replacing that account's contacts, companies, events and chats, then indexes
// it for Ask. Used by `pnpm seed:network` and the end-to-end test setup.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalizeCompanyName, normalizePhone } from "@/lib/ai/validate";
import { blindIndex, normalizeEmail } from "@/lib/crypto/blind-index";
import { sealField, sealJson } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { indexStale } from "@/lib/knowledge/indexer";
import { removeFiles } from "@/lib/storage";
import { adminClient } from "@/lib/supabase/admin";
import { toBytea } from "@/lib/supabase/bytea";

type Fixture = {
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
    email: string;
    phone?: string;
    met: [string, string][];
    notes?: string[];
    reminder?: [string, string];
  }[];
};

export const TEST_DOMAIN = /@example\.(com|org|net)$/i;
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

/**
 * Seeds the network into `userId`. With `shiftDays`, every date moves by that
 * many days, so "met last month" and overdue follow-ups stay true over time.
 */
export async function seedNetwork(userId: string, { shiftDays = 0 }: { shiftDays?: number } = {}) {
  const db = adminClient();
  const day = (d: string) => shiftDay(d, shiftDays);

  // Clear the account's network first, so seeding twice gives the same result.
  const { data: images } = await db.from("card_images").select("path, thumb_path").eq("user_id", userId);
  await removeFiles(userId, (images ?? []).flatMap((i) => [i.path, i.thumb_path]));
  for (const table of ["chat_threads", "contacts", "companies", "events"] as const) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }

  const fixture = JSON.parse(readFileSync("fixtures/network.json", "utf8")) as Fixture;
  const dek = await getUserDataKey(userId);
  const seal = (table: string, column: string, rowId: string, value: string) => toBytea(sealField(dek, value, { userId, table, column, rowId }));

  const eventIds = new Map<string, string>();
  for (const e of fixture.events) {
    const id = randomUUID();
    eventIds.set(e.key, id);
    const { error } = await db.from("events").insert({
      id,
      user_id: userId,
      name: e.name,
      starts_on: day(e.startsOn),
      location: e.location,
      description_enc: seal("events", "description_enc", id, e.description),
    });
    if (error) throw error;
  }

  const companyIds = new Map<string, string>();
  for (const c of fixture.contacts) {
    let companyId: string | null = null;
    if (c.company) {
      companyId = companyIds.get(c.company) ?? null;
      if (!companyId) {
        companyId = randomUUID();
        const domain = c.email.split("@")[1];
        const { error } = await db.from("companies").insert({
          id: companyId,
          user_id: userId,
          name: c.company,
          normalized_name: normalizeCompanyName(c.company),
          domain,
          industry: c.industry,
        });
        if (error) throw error;
        companyIds.set(c.company, companyId);
      }
    }

    const contactId = randomUUID();
    const emails = [normalizeEmail(c.email)];
    const phones = c.phone ? [normalizePhone(c.phone, "US") ?? c.phone] : [];
    const ctx = (column: string) => ({ userId, table: "contacts", column, rowId: contactId });
    const { error } = await db.from("contacts").insert({
      id: contactId,
      user_id: userId,
      full_name: c.name,
      title: c.title,
      company_id: companyId,
      industry_override: c.company ? null : c.industry,
      role_family: c.role,
      seniority: c.seniority,
      city: c.city,
      country: c.country,
      emails_enc: toBytea(sealJson(dek, emails, ctx("emails_enc"))),
      phones_enc: phones.length ? toBytea(sealJson(dek, phones, ctx("phones_enc"))) : null,
      created_at: `${day(c.met[0][1])}T10:00:00Z`,
    });
    if (error) throw error;

    await db.from("contact_identifiers").insert([
      ...emails.map((e) => ({ user_id: userId, contact_id: contactId, kind: "email", blind_index: blindIndex(userId, "email", e) })),
      ...phones.map((p) => ({ user_id: userId, contact_id: contactId, kind: "phone", blind_index: blindIndex(userId, "phone", p) })),
    ]);

    for (const [what, on] of c.met) {
      const isType = INTERACTION_TYPES.has(what);
      const { error: iError } = await db.from("interactions").insert({
        user_id: userId,
        contact_id: contactId,
        type: isType ? what : "met",
        event_id: isType ? null : eventIds.get(what),
        occurred_at: `${day(on)}T10:00:00Z`,
      });
      if (iError) throw iError;
    }

    for (const body of c.notes ?? []) {
      const id = randomUUID();
      const { error: nError } = await db.from("notes").insert({
        id,
        user_id: userId,
        contact_id: contactId,
        body_enc: seal("notes", "body_enc", id, body),
        created_at: `${day(c.met[0][1])}T18:00:00Z`,
      });
      if (nError) throw nError;
    }

    if (c.reminder) {
      const id = randomUUID();
      const { error: rError } = await db.from("reminders").insert({
        id,
        user_id: userId,
        contact_id: contactId,
        due_at: `${day(c.reminder[0])}T09:00:00Z`,
        note_enc: seal("reminders", "note_enc", id, c.reminder[1]),
      });
      if (rError) throw rError;
    }
  }

  const indexed = await indexStale({ userId, limit: 500 });
  return { contacts: fixture.contacts.length, companies: companyIds.size, events: fixture.events.length, indexed: indexed.indexed, failed: indexed.failed };
}
