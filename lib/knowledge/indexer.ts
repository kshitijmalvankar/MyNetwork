import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import { after } from "next/server";
import { embedTexts, toPgVector } from "@/lib/ai/embed";
import { globalBudgetExceeded, recordUsage, type UsageEntry } from "@/lib/ai/metering";
import { models } from "@/lib/ai/models";
import { blindIndexKey, deriveKey } from "@/lib/crypto/keys";
import { openField, sealField } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { contactHeadline, eventText, noteChunks, profileText } from "@/lib/knowledge/text";
import { adminClient } from "@/lib/supabase/admin";
import { fromBytea, toBytea } from "@/lib/supabase/bytea";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type SourceType = "contact" | "note" | "event";

type DesiredChunk = {
  sourceType: SourceType;
  sourceId: string;
  chunkIndex: number;
  contactId: string | null;
  eventId: string | null;
  noteId: string | null;
  text: string;
};

export const chunkField = (userId: string, chunkId: string) => ({ userId, table: "knowledge_chunks", column: "content_enc", rowId: chunkId });

let hashKey: Buffer | undefined;

/** Keyed so the stored hash says nothing about the (encrypted) text. */
function contentHash(userId: string, text: string): string {
  hashKey ??= deriveKey(blindIndexKey(), "chunk-hash");
  return createHmac("sha256", hashKey).update(`${userId}|${models.embedding}|${text}`).digest("base64url");
}

const day = (iso: string) => iso.slice(0, 10);

/**
 * Makes the stored chunks for one contact (or one event) match `desired`:
 * unchanged text is left alone, changed or new text is embedded, and chunks
 * whose source is gone are deleted.
 */
async function syncChunks(userId: string, scope: { contactId: string } | { eventId: string }, desired: DesiredChunk[]) {
  const db = adminClient();
  let query = db.from("knowledge_chunks").select("id, source_type, source_id, chunk_index, content_hash").eq("user_id", userId);
  query = "contactId" in scope ? query.eq("contact_id", scope.contactId) : query.eq("event_id", scope.eventId).is("contact_id", null);
  const { data: existing, error } = await query;
  if (error) throw error;

  const key = (t: string, s: string, i: number) => `${t}:${s}:${i}`;
  const byKey = new Map((existing ?? []).map((e) => [key(e.source_type, e.source_id, e.chunk_index), e]));
  const wanted = new Set<string>();
  const toWrite: (DesiredChunk & { id: string; hash: string })[] = [];

  for (const d of desired) {
    const k = key(d.sourceType, d.sourceId, d.chunkIndex);
    wanted.add(k);
    const hash = contentHash(userId, d.text);
    const current = byKey.get(k);
    if (current?.content_hash !== hash) toWrite.push({ ...d, id: current?.id ?? randomUUID(), hash });
  }
  const stale = (existing ?? []).filter((e) => !wanted.has(key(e.source_type, e.source_id, e.chunk_index))).map((e) => e.id);

  let usage: UsageEntry[] = [];
  if (toWrite.length > 0) {
    const dek = await getUserDataKey(userId);
    const embedded = await embedTexts(toWrite.map((c) => c.text), "index");
    usage = embedded.usage;
    const { error: upsertError } = await db.from("knowledge_chunks").upsert(
      toWrite.map((c, i) => ({
        id: c.id,
        user_id: userId,
        source_type: c.sourceType,
        source_id: c.sourceId,
        chunk_index: c.chunkIndex,
        contact_id: c.contactId,
        event_id: c.eventId,
        note_id: c.noteId,
        content_enc: toBytea(sealField(dek, c.text, chunkField(userId, c.id))),
        content_hash: c.hash,
        embedding: toPgVector(embedded.embeddings[i]),
        embedding_model: models.embedding,
      })),
      { onConflict: "user_id,source_type,source_id,chunk_index" },
    );
    if (upsertError) throw upsertError;
  }
  if (stale.length > 0) {
    const { error: deleteError } = await db.from("knowledge_chunks").delete().eq("user_id", userId).in("id", stale);
    if (deleteError) throw deleteError;
  }
  await recordUsage(userId, usage);
  return { written: toWrite.length, deleted: stale.length };
}

/** Rebuilds the profile and note chunks for one contact. */
export async function reindexContact(userId: string, contactId: string) {
  const db = adminClient();
  const startedAt = new Date().toISOString();
  const { data: c, error } = await db
    .from("contacts")
    .select(
      "id, full_name, name_native, title, role_family, seniority, industry_override, city, country, website, past_positions, companies(name, industry)",
    )
    .eq("id", contactId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!c) return; // deleted; its chunks went with it

  const [{ data: interactions }, { data: notes }, { data: reminders }] = await Promise.all([
    db.from("interactions").select("type, occurred_at, events(name, location)").eq("contact_id", contactId).eq("user_id", userId).order("occurred_at"),
    db.from("notes").select("id, body_enc, created_at").eq("contact_id", contactId).eq("user_id", userId).in("kind", ["text", "voice"]).order("created_at"),
    db.from("reminders").select("id, due_at, note_enc").eq("contact_id", contactId).eq("user_id", userId).is("done_at", null).order("due_at"),
  ]);

  const dek = await getUserDataKey(userId);
  const company = c.companies as { name: string; industry: string | null } | null;
  const profile = {
    fullName: c.full_name,
    nameNative: c.name_native,
    title: c.title,
    company: company?.name,
    industry: c.industry_override ?? company?.industry,
    roleFamily: c.role_family,
    seniority: c.seniority,
    city: c.city,
    country: c.country,
    website: c.website,
    pastPositions: Array.isArray(c.past_positions) ? (c.past_positions as { company: string | null; title: string | null; until: string }[]) : [],
    meetings: (interactions ?? []).map((i) => {
      const event = i.events as { name: string; location: string | null } | null;
      return { type: i.type, on: day(i.occurred_at), event: event?.name, location: event?.location };
    }),
    reminders: (reminders ?? []).map((r) => ({
      due: day(r.due_at),
      note: r.note_enc ? openField(dek, fromBytea(r.note_enc), { userId, table: "reminders", column: "note_enc", rowId: r.id }).toString("utf8") : null,
    })),
  };

  const headline = contactHeadline(profile);
  const desired: DesiredChunk[] = [
    { sourceType: "contact", sourceId: c.id, chunkIndex: 0, contactId: c.id, eventId: null, noteId: null, text: profileText(profile) },
    ...(notes ?? []).flatMap((n) => {
      const body = openField(dek, fromBytea(n.body_enc), { userId, table: "notes", column: "body_enc", rowId: n.id }).toString("utf8");
      return noteChunks(headline, day(n.created_at), body).map((text, i) => ({
        sourceType: "note" as const,
        sourceId: n.id,
        chunkIndex: i,
        contactId: c.id,
        eventId: null,
        noteId: n.id,
        text,
      }));
    }),
  ];

  const result = await syncChunks(userId, { contactId }, desired);
  await db.from("contacts").update({ indexed_at: startedAt }).eq("id", contactId).eq("user_id", userId);
  return result;
}

/** Rebuilds an event's own chunk and the chunks of notes filed only under it. */
export async function reindexEvent(userId: string, eventId: string) {
  const db = adminClient();
  const startedAt = new Date().toISOString();
  const { data: e, error } = await db
    .from("events")
    .select("id, name, starts_on, location, description_enc")
    .eq("id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!e) return;

  const { data: notes } = await db
    .from("notes")
    .select("id, body_enc, created_at")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .is("contact_id", null)
    .in("kind", ["text", "voice"]);

  const dek = await getUserDataKey(userId);
  const description = e.description_enc
    ? openField(dek, fromBytea(e.description_enc), { userId, table: "events", column: "description_enc", rowId: e.id }).toString("utf8")
    : null;
  const about = `the event ${e.name}${e.starts_on ? ` (${e.starts_on})` : ""}`;

  const desired: DesiredChunk[] = [
    {
      sourceType: "event",
      sourceId: e.id,
      chunkIndex: 0,
      contactId: null,
      eventId: e.id,
      noteId: null,
      text: eventText({ name: e.name, startsOn: e.starts_on, location: e.location, description }),
    },
    ...(notes ?? []).flatMap((n) => {
      const body = openField(dek, fromBytea(n.body_enc), { userId, table: "notes", column: "body_enc", rowId: n.id }).toString("utf8");
      return noteChunks(about, day(n.created_at), body).map((text, i) => ({
        sourceType: "note" as const,
        sourceId: n.id,
        chunkIndex: i,
        contactId: null,
        eventId: e.id,
        noteId: n.id,
        text,
      }));
    }),
  ];

  const result = await syncChunks(userId, { eventId }, desired);
  await db.from("events").update({ indexed_at: startedAt }).eq("id", eventId).eq("user_id", userId);
  return result;
}

/**
 * Re-indexes whatever is flagged as out of date, oldest first. Without a
 * userId it works across all users (cron). Failures stay flagged and are
 * retried on the next sweep.
 */
export async function indexStale({ userId, limit = 50, concurrency = 4 }: { userId?: string; limit?: number; concurrency?: number } = {}) {
  if (await globalBudgetExceeded()) return { indexed: 0, failed: 0 };
  const db = adminClient();
  const pick = (table: "contacts" | "events") => {
    let q = db.from(table).select("id, user_id").eq("needs_index", true).order("index_requested_at").limit(limit);
    if (userId) q = q.eq("user_id", userId);
    return q;
  };
  const [{ data: contacts }, { data: events }] = await Promise.all([pick("contacts"), pick("events")]);
  const jobs = [
    ...(events ?? []).map((e) => () => reindexEvent(e.user_id, e.id)),
    ...(contacts ?? []).map((c) => () => reindexContact(c.user_id, c.id)),
  ].slice(0, limit);

  let indexed = 0;
  let failed = 0;
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          await job();
          indexed++;
        } catch (err) {
          failed++;
          console.error("[index] failed", err instanceof Error ? err.message : err);
        }
      }
    }),
  );
  return { indexed, failed };
}

/** How many of the signed-in user's contacts and events are waiting to be indexed. */
export async function indexBacklog(supabase: Supabase): Promise<number> {
  const count = async (table: "contacts" | "events") => {
    const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("needs_index", true);
    return count ?? 0;
  };
  const [contacts, events] = await Promise.all([count("contacts"), count("events")]);
  return contacts + events;
}

/**
 * Call after any change that affects what Ask knows. Flags the rows in the
 * request (so a crash can't lose the change), then re-indexes them once the
 * response has been sent.
 */
export async function requestReindex(supabase: Supabase, userId: string, { contactIds = [], eventIds = [] }: { contactIds?: string[]; eventIds?: string[] }) {
  const now = new Date().toISOString();
  const contacts = [...new Set(contactIds)];
  const events = [...new Set(eventIds)];
  await Promise.all([
    contacts.length ? supabase.from("contacts").update({ index_requested_at: now }).in("id", contacts) : null,
    events.length ? supabase.from("events").update({ index_requested_at: now }).in("id", events) : null,
  ]);
  after(async () => {
    if (await globalBudgetExceeded()) return;
    for (const id of events) await reindexEvent(userId, id).catch((err) => console.error("[index] event", err?.message ?? err));
    for (const id of contacts) await reindexContact(userId, id).catch((err) => console.error("[index] contact", err?.message ?? err));
  });
}
