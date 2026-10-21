import "server-only";
import { randomUUID } from "node:crypto";
import type { ReviewedCard } from "@/lib/ai/card-schema";
import { normalizeCompanyName, normalizePhone, normalizeWebsite } from "@/lib/ai/validate";
import { blindIndex, normalizeEmail } from "@/lib/crypto/blind-index";
import { sealField, sealJson } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { toBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "me.com",
  "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "yandex.com", "qq.com", "163.com", "rediffmail.com",
]);

export type MeetingDetails = {
  eventId?: string;
  newEventName?: string;
  metOn: string; // YYYY-MM-DD
  notes?: string;
  reminderOn?: string; // YYYY-MM-DD
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Finds the user's company by normalized name, creating it if needed. */
export async function upsertCompany(supabase: Supabase, userId: string, name: string, hints: { website?: string | null; email?: string; industry?: string }) {
  const normalized = normalizeCompanyName(name);
  if (!normalized) return null;

  const { data: existing } = await supabase.from("companies").select("id, domain, industry").eq("normalized_name", normalized).maybeSingle();
  const emailDomain = hints.email?.split("@")[1]?.toLowerCase();
  const domain = hints.website ?? (emailDomain && !FREE_MAIL.has(emailDomain) ? emailDomain : null);

  if (existing) {
    // Fill gaps, never overwrite what the user already has.
    const patch: { domain?: string; industry?: string } = {};
    if (!existing.domain && domain) patch.domain = domain;
    if (!existing.industry && hints.industry) patch.industry = hints.industry;
    if (Object.keys(patch).length) await supabase.from("companies").update(patch).eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({ user_id: userId, name: name.trim(), normalized_name: normalized, domain, industry: hints.industry || null })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: raced } = await supabase.from("companies").select("id").eq("normalized_name", normalized).single();
    return raced?.id ?? null;
  }
  if (error) throw error;
  return data.id;
}

async function resolveEvent(supabase: Supabase, userId: string, meeting: MeetingDetails) {
  if (meeting.eventId) {
    const { data } = await supabase.from("events").select("id").eq("id", meeting.eventId).maybeSingle();
    return data?.id ?? null;
  }
  const name = meeting.newEventName?.trim();
  if (!name) return null;
  const { data, error } = await supabase
    .from("events")
    .insert({ user_id: userId, name, starts_on: meeting.metOn })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Saves a reviewed card as a contact. Contact details, notes and the raw AI
 * reading are encrypted with the user's key; emails and phones also get blind
 * indexes for duplicate detection.
 */
export async function createContact(
  userId: string,
  card: ReviewedCard & { nameNative?: string; titleNative?: string | null; language?: string },
  meeting: MeetingDetails,
  { sourceScanId, raw, images, defaultRegion }: {
    sourceScanId?: string;
    raw?: unknown;
    images?: { side: "front" | "back"; path: string; thumbPath?: string | null }[];
    defaultRegion?: string;
  } = {},
) {
  const supabase = await createClient();
  const dek = await getUserDataKey(userId);
  const contactId = randomUUID();
  const ctx = (column: string) => ({ userId, table: "contacts", column, rowId: contactId });

  const emails = [...new Set(card.emails.map(normalizeEmail).filter(Boolean))];
  const phones = [...new Set(card.phones.map((p) => normalizePhone(p, card.country || defaultRegion) ?? p.trim()).filter(Boolean))];
  const website = normalizeWebsite(card.website);

  const companyId = card.company ? await upsertCompany(supabase, userId, card.company, { website, email: emails[0], industry: card.industry }) : null;
  const eventId = await resolveEvent(supabase, userId, meeting);

  const { error } = await supabase.from("contacts").insert({
    id: contactId,
    user_id: userId,
    full_name: card.fullName,
    name_native: card.nameNative || null,
    title: card.title || null,
    title_native: card.titleNative || null,
    language: card.language && /^[a-z]{2,3}$/.test(card.language) ? card.language : null,
    company_id: companyId,
    website,
    city: card.city || null,
    country: card.country || null,
    role_family: card.roleFamily,
    seniority: card.seniority,
    emails_enc: emails.length ? toBytea(sealJson(dek, emails, ctx("emails_enc"))) : null,
    phones_enc: phones.length ? toBytea(sealJson(dek, phones, ctx("phones_enc"))) : null,
    address_enc: card.address ? toBytea(sealField(dek, card.address, ctx("address_enc"))) : null,
    raw_extraction_enc: raw ? toBytea(sealJson(dek, raw, ctx("raw_extraction_enc"))) : null,
    source_scan_id: sourceScanId ?? null,
  });
  if (error) throw error;

  const identifiers = [
    ...emails.map((e) => ({ kind: "email", blind_index: blindIndex(userId, "email", e) })),
    ...phones.filter((p) => p.startsWith("+")).map((p) => ({ kind: "phone", blind_index: blindIndex(userId, "phone", p) })),
  ];

  const writes: PromiseLike<{ error: unknown }>[] = [
    supabase.from("interactions").insert({
      user_id: userId,
      contact_id: contactId,
      type: "met",
      event_id: eventId,
      occurred_at: `${meeting.metOn}T12:00:00Z`,
    }),
  ];
  if (identifiers.length) {
    writes.push(supabase.from("contact_identifiers").insert(identifiers.map((i) => ({ ...i, user_id: userId, contact_id: contactId }))));
  }
  if (images?.length) {
    writes.push(
      supabase.from("card_images").insert(
        images.map((img) => ({ user_id: userId, contact_id: contactId, side: img.side, path: img.path, thumb_path: img.thumbPath ?? null })),
      ),
    );
  }
  if (meeting.notes?.trim()) {
    const noteId = randomUUID();
    writes.push(
      supabase.from("notes").insert({
        id: noteId,
        user_id: userId,
        contact_id: contactId,
        kind: "text",
        body_enc: toBytea(sealField(dek, meeting.notes.trim(), { userId, table: "notes", column: "body_enc", rowId: noteId })),
      }),
    );
  }
  if (meeting.reminderOn) {
    writes.push(
      supabase.from("reminders").insert({ user_id: userId, contact_id: contactId, due_at: `${meeting.reminderOn}T09:00:00Z` }),
    );
  }

  for (const res of await Promise.all(writes)) if (res.error) throw res.error;
  return contactId;
}
