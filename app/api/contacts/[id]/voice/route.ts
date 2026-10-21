import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { guardAiRequest, textError } from "@/lib/ai/guard";
import { recordUsage, releaseQuota } from "@/lib/ai/metering";
import { MAX_VOICE_BYTES, MAX_VOICE_SECONDS, processVoiceNote, sniffAudio } from "@/lib/ai/voice";
import { getAuthorizedUser, getProfile } from "@/lib/auth/dal";
import { sealField } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { todayIn } from "@/lib/dates";
import { contactHeadline } from "@/lib/knowledge/text";
import { requestReindex } from "@/lib/knowledge/indexer";
import { putEncrypted, removeFiles } from "@/lib/storage";
import { saveFollowUps } from "@/lib/suggestions";
import { toBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

// AAC at the 32 kbps the recorder asks for is about 4 KB a second. Using the
// larger of that and the browser's own count stops a client under-reporting.
const BYTES_PER_SECOND = 4000;

/** Saves a voice note: transcribed, summarised and stored encrypted, with any follow-ups as suggestions. */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/contacts/[id]/voice">) {
  const user = await getAuthorizedUser();
  if (!user) return textError(401, "Please sign in again.");
  const { id: contactId } = await params;
  if (!z.uuid().safeParse(contactId).success) return textError(404, "Contact not found.");

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_VOICE_BYTES + 64 * 1024) return textError(413, "That recording is too long. Keep voice notes under 5 minutes.");
  const form = await request.formData().catch(() => null);
  const file = form?.get("audio");
  if (!(file instanceof File)) return textError(400, "No recording was received.");
  if (file.size > MAX_VOICE_BYTES) return textError(413, "That recording is too long. Keep voice notes under 5 minutes.");
  if (file.size < 1000) return textError(422, "That recording is too short.");
  const audio = new Uint8Array(await file.arrayBuffer());
  const format = sniffAudio(audio);
  if (!format) return textError(415, "This browser recorded in a format we can't read. Try Chrome, Safari or Edge.");

  const claimed = Number(form?.get("seconds") ?? 0);
  const seconds = Math.ceil(Math.max(Number.isFinite(claimed) ? claimed : 0, audio.length / BYTES_PER_SECOND, 1));
  if (seconds > MAX_VOICE_SECONDS + 15) return textError(413, "That recording is too long. Keep voice notes under 5 minutes.");
  const minutes = Math.ceil(seconds / 60);

  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, full_name, title, companies(name)")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return textError(404, "Contact not found.");

  const blocked = await guardAiRequest(user.id, "voice_minutes", "voice", "voice minutes", minutes);
  if (blocked) return blocked;

  const profile = await getProfile(user.id);
  const today = todayIn(profile?.timezone);
  const about = contactHeadline({ fullName: contact.full_name, title: contact.title, company: (contact.companies as { name: string } | null)?.name });

  let result: Awaited<ReturnType<typeof processVoiceNote>>;
  try {
    result = await processVoiceNote(audio, format, { about, today, timeZone: profile?.timezone ?? "UTC" });
  } catch (err) {
    console.error("[voice] transcription failed", err instanceof Error ? err.message : err);
    await releaseQuota(user.id, "voice_minutes", minutes);
    return textError(502, "We couldn't transcribe that just now. Please try again.");
  }
  await recordUsage(user.id, [result.usage]);
  const { note } = result;
  if (!note.transcript.trim()) {
    await releaseQuota(user.id, "voice_minutes", minutes);
    return textError(422, "We couldn't hear anything in that recording. Try again a little closer to the microphone.");
  }

  const noteId = randomUUID();
  const audioPath = `${user.id}/audio/${noteId}.${format.ext}`;
  await putEncrypted(user.id, audioPath, Buffer.from(audio));
  const dek = await getUserDataKey(user.id);
  const field = (column: string) => ({ userId: user.id, table: "notes", column, rowId: noteId });
  const { error } = await supabase.from("notes").insert({
    id: noteId,
    user_id: user.id,
    contact_id: contactId,
    kind: "voice",
    body_enc: toBytea(sealField(dek, note.transcript.trim(), field("body_enc"))),
    summary_enc: note.summary.trim() ? toBytea(sealField(dek, note.summary.trim(), field("summary_enc"))) : null,
    audio_path: audioPath,
    duration_s: Math.min(seconds, 600),
  });
  if (error) {
    await removeFiles(user.id, [audioPath]);
    console.error("[voice] failed to save note", error.message);
    return textError(500, "We couldn't save that voice note. Please try again.");
  }

  const suggestions = await saveFollowUps(supabase, user.id, contactId, noteId, note.followUps).catch((err) => {
    console.error("[voice] failed to save follow-ups", err instanceof Error ? err.message : err);
    return [];
  });
  await requestReindex(supabase, user.id, { contactIds: [contactId] });

  return NextResponse.json({ noteId, summary: note.summary, suggestions }, { headers: { "Cache-Control": "no-store" } });
}
