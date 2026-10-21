"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { reviewedCardSchema } from "@/lib/ai/card-schema";
import { audit } from "@/lib/audit";
import { getProfile, requireUser } from "@/lib/auth/dal";
import { sealField } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { addNote, addReminder, recordMeeting, updateContactDetails } from "@/lib/contacts/write";
import { requestReindex } from "@/lib/knowledge/indexer";
import { rateLimit } from "@/lib/ratelimit";
import { removeFiles } from "@/lib/storage";
import { toBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";

export type Result = { ok: true } | { ok: false; message: string };

const id = z.uuid();
const isoDate = z.iso.date();

async function guard() {
  const user = await requireUser();
  if (!(await rateLimit("edit", user.id)).success) throw new Error("rate");
  return user;
}

function fail(err: unknown): Result {
  if (err instanceof Error && err.message === "rate") return { ok: false, message: "Slow down a little and try again." };
  console.error("[contacts]", err instanceof Error ? err.message : err);
  return { ok: false, message: "Something went wrong. Please try again." };
}

const refresh = (contactId?: string) => {
  if (contactId) revalidatePath(`/contacts/${contactId}`);
  revalidatePath("/contacts");
  revalidatePath("/home");
};

const editSchema = reviewedCardSchema.extend({
  nameNative: z.string().trim().max(200).optional().default(""),
  industryOverride: z.string().trim().max(80).optional().default(""),
});

export async function editContact(contactId: string, input: z.input<typeof editSchema>): Promise<Result> {
  try {
    const user = await guard();
    const parsed = editSchema.safeParse(input);
    if (!parsed.success || !id.safeParse(contactId).success) return { ok: false, message: parsed.error?.issues[0]?.message ?? "Invalid input" };
    const profile = await getProfile(user.id);
    await updateContactDetails(user.id, contactId, parsed.data, { defaultRegion: profile?.phone_region });
    await requestReindex(await createClient(), user.id, { contactIds: [contactId] });
    refresh(contactId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteContact(contactId: string): Promise<Result> {
  try {
    const user = await guard();
    if (!id.safeParse(contactId).success) return { ok: false, message: "Invalid contact" };
    const supabase = await createClient();
    const { data: images } = await supabase.from("card_images").select("path, thumb_path").eq("contact_id", contactId);
    const { data, error } = await supabase.from("contacts").delete().eq("id", contactId).select("id").maybeSingle();
    if (error || !data) return { ok: false, message: "Couldn't delete this contact." };
    await removeFiles(user.id, (images ?? []).flatMap((i) => [i.path, i.thumb_path]));
    await audit({ userId: user.id, action: "contact.deleted", targetType: "contact", targetId: contactId });
    refresh();
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

const noteBody = z.string().trim().min(1, "Write something first").max(5000);

export async function createNote(contactId: string, body: string): Promise<Result> {
  try {
    const user = await guard();
    const parsed = noteBody.safeParse(body);
    if (!parsed.success || !id.safeParse(contactId).success) return { ok: false, message: parsed.error?.issues[0]?.message ?? "Invalid" };
    const supabase = await createClient();
    const { data: contact } = await supabase.from("contacts").select("id").eq("id", contactId).maybeSingle();
    if (!contact) return { ok: false, message: "Contact not found" };
    await addNote(supabase, user.id, contactId, parsed.data);
    await requestReindex(supabase, user.id, { contactIds: [contactId] });
    refresh(contactId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function updateNote(contactId: string, noteId: string, body: string): Promise<Result> {
  try {
    const user = await guard();
    const parsed = noteBody.safeParse(body);
    if (!parsed.success || !id.safeParse(noteId).success) return { ok: false, message: parsed.error?.issues[0]?.message ?? "Invalid" };
    const dek = await getUserDataKey(user.id);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notes")
      .update({ body_enc: toBytea(sealField(dek, parsed.data, { userId: user.id, table: "notes", column: "body_enc", rowId: noteId })) })
      .eq("id", noteId)
      .select("id")
      .maybeSingle();
    if (error || !data) return { ok: false, message: "Couldn't save the note." };
    await requestReindex(supabase, user.id, { contactIds: [contactId] });
    refresh(contactId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteNote(contactId: string, noteId: string): Promise<Result> {
  try {
    await guard();
    const supabase = await createClient();
    await supabase.from("notes").delete().eq("id", noteId);
    refresh(contactId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Reminders
// ---------------------------------------------------------------------------

export async function createReminder(contactId: string, dueOn: string, note?: string): Promise<Result> {
  try {
    const user = await guard();
    if (!isoDate.safeParse(dueOn).success || !id.safeParse(contactId).success) return { ok: false, message: "Pick a date" };
    const supabase = await createClient();
    const { data: contact } = await supabase.from("contacts").select("id").eq("id", contactId).maybeSingle();
    if (!contact) return { ok: false, message: "Contact not found" };
    await addReminder(supabase, user.id, contactId, dueOn, note?.trim().slice(0, 500) || undefined);
    await requestReindex(supabase, user.id, { contactIds: [contactId] });
    refresh(contactId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setReminderDone(contactId: string | null, reminderId: string, done: boolean): Promise<Result> {
  try {
    const user = await guard();
    const supabase = await createClient();
    const { data } = await supabase
      .from("reminders")
      .update({ done_at: done ? new Date().toISOString() : null })
      .eq("id", reminderId)
      .select("contact_id")
      .maybeSingle();
    if (data) await requestReindex(supabase, user.id, { contactIds: [data.contact_id] });
    refresh(contactId ?? undefined);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteReminder(contactId: string, reminderId: string): Promise<Result> {
  try {
    const user = await guard();
    const supabase = await createClient();
    const { data } = await supabase.from("reminders").delete().eq("id", reminderId).select("contact_id").maybeSingle();
    if (data) await requestReindex(supabase, user.id, { contactIds: [data.contact_id] });
    refresh(contactId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

const interactionSchema = z.object({
  type: z.enum(["met", "email", "call", "meeting", "message"]),
  metOn: isoDate,
  eventId: z.uuid().optional(),
  newEventName: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export async function logInteraction(contactId: string, input: z.input<typeof interactionSchema>): Promise<Result> {
  try {
    const user = await guard();
    const parsed = interactionSchema.safeParse(input);
    if (!parsed.success || !id.safeParse(contactId).success) return { ok: false, message: "Check the details and try again." };
    const supabase = await createClient();
    const { data: contact } = await supabase.from("contacts").select("id").eq("id", contactId).maybeSingle();
    if (!contact) return { ok: false, message: "Contact not found" };
    await recordMeeting(supabase, user.id, contactId, parsed.data);
    await requestReindex(supabase, user.id, { contactIds: [contactId] });
    refresh(contactId);
    revalidatePath("/events");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteInteraction(contactId: string, interactionId: string): Promise<Result> {
  try {
    const user = await guard();
    const supabase = await createClient();
    const { data } = await supabase.from("interactions").delete().eq("id", interactionId).select("contact_id").maybeSingle();
    if (data) await requestReindex(supabase, user.id, { contactIds: [data.contact_id] });
    refresh(contactId);
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
