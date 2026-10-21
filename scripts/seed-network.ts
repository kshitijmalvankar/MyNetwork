// Loads the fictional network in fixtures/network.json into the local test
// account (E2E_TEST_EMAIL), replacing that account's contacts, companies,
// events and chats, then indexes it for Ask. Refuses any account that isn't on
// a reserved example domain.
//
//   pnpm seed:network
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

const TEST_DOMAIN = /@example\.(com|org|net)$/i;
const INTERACTION_TYPES = new Set(["met", "email", "call", "meeting", "message"]);

async function main() {
  const email = process.env.E2E_TEST_EMAIL ?? "";
  if (!TEST_DOMAIN.test(email)) throw new Error("E2E_TEST_EMAIL must use a reserved example domain (example.com/org/net).");

  const db = adminClient();
  let userId: string | undefined;
  for (let page = 1; !userId; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email === email.toLowerCase())?.id;
    if (data.users.length < 200) break;
  }
  if (!userId) throw new Error("Test account not found. Run `pnpm seed:dev` first.");

  // Clear the test account's network (never touches any other account).
  const { data: images } = await db.from("card_images").select("path, thumb_path").eq("user_id", userId);
  await removeFiles(userId, (images ?? []).flatMap((i) => [i.path, i.thumb_path]));
  for (const table of ["chat_threads", "contacts", "companies", "events"] as const) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error) throw error;
  }

  const fixture = JSON.parse(readFileSync("fixtures/network.json", "utf8")) as Fixture;
  const dek = await getUserDataKey(userId);
  const seal = (table: string, column: string, rowId: string, value: string) => toBytea(sealField(dek, value, { userId: userId!, table, column, rowId }));

  const eventIds = new Map<string, string>();
  for (const e of fixture.events) {
    const id = randomUUID();
    eventIds.set(e.key, id);
    const { error } = await db.from("events").insert({
      id,
      user_id: userId,
      name: e.name,
      starts_on: e.startsOn,
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
    const ctx = (column: string) => ({ userId: userId!, table: "contacts", column, rowId: contactId });
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
      created_at: `${c.met[0][1]}T10:00:00Z`,
    });
    if (error) throw error;

    await db.from("contact_identifiers").insert([
      ...emails.map((e) => ({ user_id: userId, contact_id: contactId, kind: "email", blind_index: blindIndex(userId!, "email", e) })),
      ...phones.map((p) => ({ user_id: userId, contact_id: contactId, kind: "phone", blind_index: blindIndex(userId!, "phone", p) })),
    ]);

    for (const [what, on] of c.met) {
      const isType = INTERACTION_TYPES.has(what);
      const { error: iError } = await db.from("interactions").insert({
        user_id: userId,
        contact_id: contactId,
        type: isType ? what : "met",
        event_id: isType ? null : eventIds.get(what),
        occurred_at: `${on}T10:00:00Z`,
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
        created_at: `${c.met[0][1]}T18:00:00Z`,
      });
      if (nError) throw nError;
    }

    if (c.reminder) {
      const id = randomUUID();
      const { error: rError } = await db.from("reminders").insert({
        id,
        user_id: userId,
        contact_id: contactId,
        due_at: `${c.reminder[0]}T09:00:00Z`,
        note_enc: seal("reminders", "note_enc", id, c.reminder[1]),
      });
      if (rError) throw rError;
    }
  }

  console.log(`Seeded ${fixture.contacts.length} contacts, ${companyIds.size} companies and ${fixture.events.length} events.`);
  const result = await indexStale({ userId, limit: 500 });
  console.log(`Indexed ${result.indexed} items for Ask${result.failed ? `, ${result.failed} failed` : ""}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
