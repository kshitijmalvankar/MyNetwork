import "server-only";
import { randomUUID } from "node:crypto";
import { after } from "next/server";
import type { ReviewedCard } from "@/lib/ai/card-schema";
import { normalizeCompanyName, normalizePhone, normalizeWebsite } from "@/lib/ai/validate";
import { blindIndex, normalizeEmail } from "@/lib/crypto/blind-index";
import { openField, openJson, sealField, sealJson } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { suggestFromNote } from "@/lib/suggestions";
import { fromBytea, toBytea } from "@/lib/supabase/bytea";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "me.com",
  "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "yandex.com", "qq.com", "163.com", "rediffmail.com",
]);

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type MeetingDetails = {
  type?: "met" | "email" | "call" | "meeting" | "message";
  eventId?: string;
  newEventName?: string;
  metOn: string; // YYYY-MM-DD
  notes?: string;
  reminderOn?: string; // YYYY-MM-DD
};

export type CardImageRef = { side: "front" | "back"; path: string; thumbPath?: string | null };

export type ContactInput = ReviewedCard & { nameNative?: string; titleNative?: string | null; language?: string; industryOverride?: string };

const contactCtx = (userId: string, contactId: string, column: string) => ({ userId, table: "contacts", column, rowId: contactId });

export function normalizeContactDetails(card: Pick<ContactInput, "emails" | "phones" | "website" | "country">, defaultRegion?: string) {
  return {
    emails: [...new Set(card.emails.map(normalizeEmail).filter(Boolean))],
    phones: [...new Set(card.phones.map((p) => normalizePhone(p, card.country || defaultRegion) ?? p.trim()).filter(Boolean))],
    website: normalizeWebsite(card.website),
  };
}

/** Finds the user's company by normalized name, creating it if needed. */
export async function upsertCompany(
  supabase: Supabase,
  userId: string,
  name: string,
  hints: { website?: string | null; email?: string; industry?: string },
) {
  const normalized = normalizeCompanyName(name);
  if (!normalized) return null;

  const { data: existing } = await supabase.from("companies").select("id, domain, industry").eq("normalized_name", normalized).maybeSingle();
  const emailDomain = hints.email?.split("@")[1]?.toLowerCase();
  const domain = hints.website ?? (emailDomain && !FREE_MAIL.has(emailDomain) ? emailDomain : null);

  if (existing) {
    // Fill gaps; never overwrite what the user already has.
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

async function resolveEvent(supabase: Supabase, userId: string, meeting: Pick<MeetingDetails, "eventId" | "newEventName" | "metOn">) {
  if (meeting.eventId) {
    const { data } = await supabase.from("events").select("id").eq("id", meeting.eventId).maybeSingle();
    return data?.id ?? null;
  }
  const name = meeting.newEventName?.trim();
  if (!name) return null;
  const { data, error } = await supabase.from("events").insert({ user_id: userId, name, starts_on: meeting.metOn }).select("id").single();
  if (error) throw error;
  return data.id;
}

/** Replaces a contact's email/phone fingerprints (used for duplicate detection). */
async function syncIdentifiers(supabase: Supabase, userId: string, contactId: string, emails: string[], phones: string[]) {
  await supabase.from("contact_identifiers").delete().eq("contact_id", contactId);
  const rows = [
    ...emails.map((e) => ({ kind: "email", blind_index: blindIndex(userId, "email", e) })),
    ...phones.filter((p) => p.startsWith("+")).map((p) => ({ kind: "phone", blind_index: blindIndex(userId, "phone", p) })),
  ];
  if (rows.length) {
    const { error } = await supabase
      .from("contact_identifiers")
      .insert(rows.map((r) => ({ ...r, user_id: userId, contact_id: contactId })));
    if (error) throw error;
  }
}

/** Adds an encrypted note to a contact. */
export async function addNote(supabase: Supabase, userId: string, contactId: string, body: string, kind: "text" | "voice" | "draft" | "brief" = "text") {
  const dek = await getUserDataKey(userId);
  const id = randomUUID();
  const { error } = await supabase.from("notes").insert({
    id,
    user_id: userId,
    contact_id: contactId,
    kind,
    body_enc: toBytea(sealField(dek, body, { userId, table: "notes", column: "body_enc", rowId: id })),
  });
  if (error) throw error;
  // Typed notes may contain promises ("I'll send the deck Friday"); look for them after the response is sent.
  if (kind === "text") after(() => suggestFromNote(userId, contactId, id, body));
  return id;
}

export async function addReminder(supabase: Supabase, userId: string, contactId: string, dueOn: string, note?: string, source: "user" | "ai" = "user") {
  const id = randomUUID();
  const dek = note ? await getUserDataKey(userId) : null;
  const { error } = await supabase.from("reminders").insert({
    id,
    user_id: userId,
    contact_id: contactId,
    due_at: `${dueOn}T09:00:00Z`,
    source,
    note_enc: dek && note ? toBytea(sealField(dek, note, { userId, table: "reminders", column: "note_enc", rowId: id })) : null,
  });
  if (error) throw error;
  return id;
}

/** Logs that you met or spoke with someone, plus any note and follow-up reminder. */
export async function recordMeeting(supabase: Supabase, userId: string, contactId: string, meeting: MeetingDetails) {
  const eventId = await resolveEvent(supabase, userId, meeting);
  const { error } = await supabase.from("interactions").insert({
    user_id: userId,
    contact_id: contactId,
    type: meeting.type ?? "met",
    event_id: eventId,
    occurred_at: `${meeting.metOn}T12:00:00Z`,
  });
  if (error) throw error;
  if (meeting.notes?.trim()) await addNote(supabase, userId, contactId, meeting.notes.trim());
  if (meeting.reminderOn) await addReminder(supabase, userId, contactId, meeting.reminderOn);
}

async function addCardImages(supabase: Supabase, userId: string, contactId: string, images: CardImageRef[] | undefined) {
  if (!images?.length) return;
  const { error } = await supabase
    .from("card_images")
    .insert(images.map((i) => ({ user_id: userId, contact_id: contactId, side: i.side, path: i.path, thumb_path: i.thumbPath ?? null })));
  if (error) throw error;
}

type SaveOptions = { sourceScanId?: string; raw?: unknown; images?: CardImageRef[]; defaultRegion?: string };

/**
 * Saves a reviewed card as a new contact. Contact details, notes and the raw
 * AI reading are encrypted with the user's key; emails and phones also get
 * blind indexes for duplicate detection.
 */
export async function createContact(userId: string, card: ContactInput, meeting: MeetingDetails, opts: SaveOptions = {}) {
  const supabase = await createClient();
  const dek = await getUserDataKey(userId);
  const contactId = randomUUID();
  const ctx = (column: string) => contactCtx(userId, contactId, column);
  const { emails, phones, website } = normalizeContactDetails(card, opts.defaultRegion);

  const companyId = card.company ? await upsertCompany(supabase, userId, card.company, { website, email: emails[0], industry: card.industry }) : null;

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
    industry_override: card.industryOverride || null,
    emails_enc: emails.length ? toBytea(sealJson(dek, emails, ctx("emails_enc"))) : null,
    phones_enc: phones.length ? toBytea(sealJson(dek, phones, ctx("phones_enc"))) : null,
    address_enc: card.address ? toBytea(sealField(dek, card.address, ctx("address_enc"))) : null,
    raw_extraction_enc: opts.raw ? toBytea(sealJson(dek, opts.raw, ctx("raw_extraction_enc"))) : null,
    source_scan_id: opts.sourceScanId ?? null,
  });
  if (error) throw error;

  await syncIdentifiers(supabase, userId, contactId, emails, phones);
  await addCardImages(supabase, userId, contactId, opts.images);
  await recordMeeting(supabase, userId, contactId, meeting);
  return contactId;
}

type ExistingContact = {
  title: string | null;
  company_id: string | null;
  companies: { name: string } | null;
  past_positions: unknown;
  emails_enc: string | null;
  phones_enc: string | null;
  address_enc: string | null;
};

async function loadExisting(supabase: Supabase, contactId: string) {
  const { data } = await supabase
    .from("contacts")
    .select("title, company_id, companies(name), past_positions, emails_enc, phones_enc, address_enc")
    .eq("id", contactId)
    .maybeSingle();
  return data as ExistingContact | null;
}

function withPastPosition(existing: ExistingContact, newCompanyId: string | null, today: string) {
  const past = (Array.isArray(existing.past_positions) ? existing.past_positions : []) as { company: string | null; title: string | null; until: string }[];
  if (existing.company_id && newCompanyId !== existing.company_id) {
    return [{ company: existing.companies?.name ?? null, title: existing.title, until: today }, ...past].slice(0, 20);
  }
  return past;
}

/** Edits a contact. A company change keeps the old job in `past_positions`. */
export async function updateContactDetails(userId: string, contactId: string, card: ContactInput, { defaultRegion }: { defaultRegion?: string } = {}) {
  const supabase = await createClient();
  const existing = await loadExisting(supabase, contactId);
  if (!existing) throw new Error("Contact not found");
  const dek = await getUserDataKey(userId);
  const ctx = (column: string) => contactCtx(userId, contactId, column);
  const { emails, phones, website } = normalizeContactDetails(card, defaultRegion);
  const companyId = card.company ? await upsertCompany(supabase, userId, card.company, { website, email: emails[0], industry: card.industry }) : null;

  const { error } = await supabase
    .from("contacts")
    .update({
      full_name: card.fullName,
      name_native: card.nameNative || null,
      title: card.title || null,
      company_id: companyId,
      website,
      city: card.city || null,
      country: card.country || null,
      role_family: card.roleFamily,
      seniority: card.seniority,
      industry_override: card.industryOverride || null,
      emails_enc: emails.length ? toBytea(sealJson(dek, emails, ctx("emails_enc"))) : null,
      phones_enc: phones.length ? toBytea(sealJson(dek, phones, ctx("phones_enc"))) : null,
      address_enc: card.address ? toBytea(sealField(dek, card.address, ctx("address_enc"))) : null,
      past_positions: withPastPosition(existing, companyId, new Date().toISOString().slice(0, 10)),
    })
    .eq("id", contactId);
  if (error) throw error;
  await syncIdentifiers(supabase, userId, contactId, emails, phones);
}

/**
 * Folds a newly scanned card into an existing contact: contact details are
 * combined, the newer card's job wins (the old one moves to past positions),
 * and the meeting, note and card photos are added.
 */
export async function mergeCardIntoContact(userId: string, contactId: string, card: ContactInput, meeting: MeetingDetails, opts: SaveOptions = {}) {
  const supabase = await createClient();
  const existing = await loadExisting(supabase, contactId);
  if (!existing) throw new Error("Contact not found");
  const dek = await getUserDataKey(userId);
  const ctx = (column: string) => contactCtx(userId, contactId, column);

  const oldEmails = existing.emails_enc ? openJson<string[]>(dek, fromBytea(existing.emails_enc), ctx("emails_enc")) : [];
  const oldPhones = existing.phones_enc ? openJson<string[]>(dek, fromBytea(existing.phones_enc), ctx("phones_enc")) : [];
  const oldAddress = existing.address_enc ? openField(dek, fromBytea(existing.address_enc), ctx("address_enc")).toString("utf8") : "";

  const fresh = normalizeContactDetails(card, opts.defaultRegion);
  const emails = [...new Set([...fresh.emails, ...oldEmails])];
  const phones = [...new Set([...fresh.phones, ...oldPhones])];
  const address = card.address || oldAddress;
  const companyId = card.company
    ? await upsertCompany(supabase, userId, card.company, { website: fresh.website, email: fresh.emails[0], industry: card.industry })
    : existing.company_id;

  const patch: Database["public"]["Tables"]["contacts"]["Update"] = {
    full_name: card.fullName,
    title: card.title || existing.title,
    company_id: companyId,
    role_family: card.roleFamily,
    seniority: card.seniority,
    emails_enc: emails.length ? toBytea(sealJson(dek, emails, ctx("emails_enc"))) : null,
    phones_enc: phones.length ? toBytea(sealJson(dek, phones, ctx("phones_enc"))) : null,
    address_enc: address ? toBytea(sealField(dek, address, ctx("address_enc"))) : null,
    past_positions: withPastPosition(existing, companyId, meeting.metOn),
  };
  if (card.nameNative) patch.name_native = card.nameNative;
  if (fresh.website) patch.website = fresh.website;
  if (card.city) patch.city = card.city;
  if (card.country) patch.country = card.country;

  const { error } = await supabase.from("contacts").update(patch).eq("id", contactId);
  if (error) throw error;

  await syncIdentifiers(supabase, userId, contactId, emails, phones);
  await addCardImages(supabase, userId, contactId, opts.images);
  await recordMeeting(supabase, userId, contactId, meeting);
}
