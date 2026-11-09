import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { globalBudgetExceeded, recordUsage, userBudgetExceeded } from "@/lib/ai/metering";
import { analyzeNote, type NoteAnalysis } from "@/lib/ai/note-analysis";
import { employerResolver, matchPerson, type PastJob } from "@/lib/connections";
import { openField, openJson, sealField, sealJson } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { todayIn } from "@/lib/dates";
import { contactHeadline } from "@/lib/knowledge/text";
import { adminClient } from "@/lib/supabase/admin";
import { fromBytea, toBytea } from "@/lib/supabase/bytea";
import type { Database } from "@/lib/supabase/database.types";
import { mergeTopics, normalizeTopic } from "@/lib/topics";

type Supabase = SupabaseClient<Database>;

export type FollowUpItem = { action: string; dueDate: string | null };

/** What a note showed about someone, for the user to accept or dismiss. */
export type Finding =
  | { kind: "connection"; relation: "knows" | "introduced_by" | "introduced"; evidence: string }
  | { kind: "past_job"; company: string; title: string | null }
  | { kind: "topics"; topics: string[] };

export type Suggestion = {
  id: string;
  kind: "follow_up" | "reconnect" | Finding["kind"];
  contactId: string;
  name: string;
  subtitle: string | null;
  text: string | null;
  dueOn: string | null;
  lastContact: string | null;
  createdAt: string;
  /** The other person, for a connection. */
  other: { id: string; name: string } | null;
  finding: Finding | null;
};

const textField = (userId: string, id: string) => ({ userId, table: "ai_suggestions", column: "text_enc", rowId: id });
const payloadField = (userId: string, id: string) => ({ userId, table: "ai_suggestions", column: "payload_enc", rowId: id });
export const topicsField = (userId: string, contactId: string) => ({ userId, table: "contacts", column: "topics_enc", rowId: contactId });
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

/** Stores follow-ups found in a note as suggestions for the user to accept or dismiss. */
export async function saveFollowUps(db: Supabase, userId: string, contactId: string, noteId: string, items: FollowUpItem[]) {
  const clean = items.map((i) => ({ action: i.action.trim().slice(0, 300), dueDate: i.dueDate && isoDate.test(i.dueDate) ? i.dueDate : null })).filter((i) => i.action);
  if (clean.length === 0) return [];
  const dek = await getUserDataKey(userId);
  const rows = clean.slice(0, 5).map((i) => {
    const id = crypto.randomUUID();
    return { id, user_id: userId, kind: "follow_up", contact_id: contactId, note_id: noteId, due_on: i.dueDate, text_enc: toBytea(sealField(dek, i.action, textField(userId, id))) };
  });
  const { error } = await db.from("ai_suggestions").insert(rows);
  if (error) throw error;
  return rows.map((r, i) => ({ id: r.id, text: clean[i].action, dueOn: clean[i].dueDate }));
}

type Subject = { id: string; companyId: string | null; pastJobs: PastJob[]; topics: string[] };

/**
 * Turns what a note showed into suggestions, leaving out anything already
 * recorded or already suggested (including ones the user dismissed).
 */
export async function saveFindings(
  db: Supabase,
  userId: string,
  subject: Subject,
  noteId: string,
  analysis: Pick<NoteAnalysis, "people" | "pastJobs" | "topics">,
  network: { people: { id: string; name: string }[]; companies: { id: string; name: string }[] },
) {
  const dek = await getUserDataKey(userId);
  const [{ data: links }, { data: earlier }] = await Promise.all([
    db.from("contact_links").select("contact_id, other_id").eq("user_id", userId).or(`contact_id.eq.${subject.id},other_id.eq.${subject.id}`),
    db
      .from("ai_suggestions")
      .select("id, kind, contact_id, other_id, payload_enc")
      .eq("user_id", userId)
      .in("kind", ["connection", "past_job", "topics"])
      .or(`contact_id.eq.${subject.id},other_id.eq.${subject.id}`),
  ]);
  const linked = new Set((links ?? []).map((l) => (l.contact_id === subject.id ? l.other_id : l.contact_id)));
  for (const s of earlier ?? []) if (s.kind === "connection") linked.add(s.contact_id === subject.id ? s.other_id! : s.contact_id);
  const earlierFinding = (kind: Finding["kind"]) =>
    (earlier ?? [])
      .filter((s) => s.kind === kind && s.contact_id === subject.id && s.payload_enc)
      .map((s) => openJson<Finding>(dek, fromBytea(s.payload_enc!), payloadField(userId, s.id)));

  const findings: { finding: Finding; otherId: string | null }[] = [];

  for (const p of analysis.people) {
    const otherId = matchPerson(p.name, network.people.filter((x) => x.id !== subject.id));
    if (!otherId || linked.has(otherId)) continue;
    linked.add(otherId);
    findings.push({ otherId, finding: { kind: "connection", relation: p.relation, evidence: p.evidence.trim().slice(0, 200) } });
  }

  const resolve = employerResolver(network.companies);
  const known = new Set(
    [
      subject.companyId,
      ...subject.pastJobs.map((j) => resolve(j.company)?.id),
      ...earlierFinding("past_job").map((f) => (f.kind === "past_job" ? resolve(f.company)?.id : null)),
    ].filter(Boolean),
  );
  for (const j of analysis.pastJobs) {
    const employer = resolve(j.company);
    if (!employer || known.has(employer.id)) continue;
    known.add(employer.id);
    findings.push({ otherId: null, finding: { kind: "past_job", company: j.company.trim().slice(0, 200), title: j.title?.trim().slice(0, 200) || null } });
  }

  const seen = mergeTopics(subject.topics, earlierFinding("topics").flatMap((f) => (f.kind === "topics" ? f.topics : [])));
  const topics = mergeTopics([], analysis.topics).filter((t) => !seen.includes(t));
  if (topics.length) findings.push({ otherId: null, finding: { kind: "topics", topics } });

  if (findings.length === 0) return 0;
  const rows = findings.map(({ finding, otherId }) => {
    const id = crypto.randomUUID();
    return { id, user_id: userId, kind: finding.kind, contact_id: subject.id, other_id: otherId, note_id: noteId, payload_enc: toBytea(sealJson(dek, finding, payloadField(userId, id))) };
  });
  const { error } = await db.from("ai_suggestions").insert(rows);
  if (error) throw error;
  return rows.length;
}

/** Decrypts someone's topics. */
export function openTopics(dek: Buffer, userId: string, contactId: string, value: string | null): string[] {
  return value ? openJson<string[]>(dek, fromBytea(value), topicsField(userId, contactId)) : [];
}

/**
 * Background step after a note is saved: one AI call reads it for follow-ups,
 * connections, past jobs and topics. A failure only loses suggestions, never the note.
 */
export async function suggestFromNote(userId: string, contactId: string, noteId: string, body: string, { followUps = true }: { followUps?: boolean } = {}) {
  try {
    // Notes have no monthly allowance, so the daily budgets are what bound this.
    if (body.trim().length < 15 || (await globalBudgetExceeded()) || (await userBudgetExceeded(userId))) return;
    const db = adminClient();
    const [{ data: c }, { data: profile }, { data: people }, { data: companies }] = await Promise.all([
      db.from("contacts").select("id, full_name, title, company_id, past_positions, topics_enc, companies(name)").eq("id", contactId).eq("user_id", userId).maybeSingle(),
      db.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
      db.from("contacts").select("id, full_name, topics_enc").eq("user_id", userId).range(0, 4999),
      db.from("companies").select("id, name").eq("user_id", userId).range(0, 4999),
    ]);
    if (!c) return;
    const dek = await getUserDataKey(userId);
    const company = (c.companies as { name: string } | null)?.name ?? null;

    // The topics already used most, so the AI calls the same thing by the same name.
    const counts = new Map<string, number>();
    for (const p of people ?? []) for (const t of openTopics(dek, userId, p.id, p.topics_enc)) counts.set(t, (counts.get(t) ?? 0) + 1);
    const vocabulary = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([t]) => t);

    const { analysis, usage } = await analyzeNote(body, {
      about: contactHeadline({ fullName: c.full_name, title: c.title, company: company ?? undefined }),
      firstName: c.full_name.split(/\s+/)[0],
      company,
      today: todayIn(profile?.timezone),
      topics: vocabulary,
      followUps,
    });
    await recordUsage(userId, [usage]);
    if (followUps) await saveFollowUps(db, userId, contactId, noteId, analysis.followUps);
    await saveFindings(
      db,
      userId,
      { id: c.id, companyId: c.company_id, pastJobs: Array.isArray(c.past_positions) ? (c.past_positions as PastJob[]) : [], topics: openTopics(dek, userId, c.id, c.topics_enc) },
      noteId,
      analysis,
      { people: (people ?? []).map((p) => ({ id: p.id, name: p.full_name })), companies: companies ?? [] },
    );
  } catch (err) {
    console.error("[suggestions] reading a note failed", err instanceof Error ? err.message : err);
  }
}

/** Adds "it's been a while" suggestions for one user (or everyone, from cron). No AI involved. */
export async function refreshReconnects(userId?: string) {
  const { data, error } = await adminClient().rpc("suggest_reconnects", { p_user_id: userId });
  if (error) console.error("[suggestions] reconnects failed", error.message);
  return data ?? 0;
}

export async function getSuggestions(supabase: Supabase, userId: string, { contactId, limit = 20 }: { contactId?: string; limit?: number } = {}) {
  let query = supabase
    .from("ai_suggestions")
    .select(
      "id, kind, contact_id, due_on, text_enc, payload_enc, created_at, contacts!ai_suggestions_contact_id_fkey(full_name, title, last_contacted_at, created_at, companies(name)), other:contacts!ai_suggestions_other_id_fkey(id, full_name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (contactId) query = query.eq("contact_id", contactId);
  const { data } = await query;
  if (!data?.length) return [];
  const dek = data.some((s) => s.text_enc || s.payload_enc) ? await getUserDataKey(userId) : null;
  return data.map((s): Suggestion => {
    const c = s.contacts as { full_name: string; title: string | null; last_contacted_at: string | null; created_at: string; companies: { name: string } | null } | null;
    const other = s.other as { id: string; full_name: string } | null;
    return {
      id: s.id,
      kind: s.kind as Suggestion["kind"],
      contactId: s.contact_id,
      name: c?.full_name ?? "Someone",
      subtitle: [c?.title, c?.companies?.name].filter(Boolean).join(" at ") || null,
      text: dek && s.text_enc ? openField(dek, fromBytea(s.text_enc), textField(userId, s.id)).toString("utf8") : null,
      dueOn: s.due_on,
      lastContact: c?.last_contacted_at ?? c?.created_at ?? null,
      createdAt: s.created_at,
      other: other ? { id: other.id, name: other.full_name } : null,
      finding: dek && s.payload_enc ? openJson<Finding>(dek, fromBytea(s.payload_enc), payloadField(userId, s.id)) : null,
    };
  });
}

export { normalizeTopic };
