"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { reviewedCardSchema } from "@/lib/ai/card-schema";
import { requireUser } from "@/lib/auth/dal";
import { createContact } from "@/lib/contacts/create";
import { rateLimit } from "@/lib/ratelimit";
import { getScanForReview } from "@/lib/scans/queries";
import { processScan } from "@/lib/scans/process";
import { removeFiles } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const isoDate = z.iso.date();

const saveSchema = z.object({
  card: reviewedCardSchema,
  nameNative: z.string().trim().max(200).optional(),
  meeting: z.object({
    eventId: z.uuid().optional(),
    newEventName: z.string().trim().max(200).optional(),
    metOn: isoDate,
    notes: z.string().trim().max(5000).optional(),
    reminderOn: isoDate.optional(),
  }),
});

export type SaveInput = z.input<typeof saveSchema>;
export type ActionResult = { ok: true; nextScanId: string | null; contactId?: string } | { ok: false; message: string };

async function nextNeedsReview(excludeId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scans")
    .select("id")
    .eq("status", "needs_review")
    .neq("id", excludeId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function saveReviewedScan(scanId: string, input: SaveInput): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await rateLimit("review", user.id)).success) return { ok: false, message: "Slow down a little and try again." };

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the form." };

  const scan = await getScanForReview(user.id, scanId);
  if (!scan) return { ok: false, message: "This card was already saved or removed." };

  const supabase = await createClient();
  const { data: paths } = await supabase.from("scans").select("front_path, back_path, thumb_path").eq("id", scanId).single();
  const { data: profile } = await supabase.from("profiles").select("phone_region").eq("id", user.id).maybeSingle();

  const contactId = await createContact(
    user.id,
    { ...parsed.data.card, nameNative: parsed.data.nameNative ?? "", titleNative: scan.stored.card.titleNative, language: scan.stored.card.language },
    parsed.data.meeting,
    {
      sourceScanId: scanId,
      raw: scan.stored,
      defaultRegion: profile?.phone_region,
      images: [
        { side: "front", path: paths!.front_path, thumbPath: paths!.thumb_path },
        ...(paths?.back_path ? [{ side: "back" as const, path: paths.back_path }] : []),
      ],
    },
  );

  // The raw reading now lives (encrypted) on the contact; drop the copy on the scan.
  await supabase.from("scans").update({ status: "saved", contact_id: contactId, extraction_enc: null }).eq("id", scanId);

  revalidatePath("/review");
  revalidatePath("/contacts");
  revalidatePath("/home");
  return { ok: true, nextScanId: await nextNeedsReview(scanId), contactId };
}

export async function discardScan(scanId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: scan } = await supabase
    .from("scans")
    .select("front_path, back_path, thumb_path, status")
    .eq("id", scanId)
    .maybeSingle();
  if (!scan || scan.status === "saved") return { ok: false, message: "This card can't be removed." };

  await supabase.from("scans").update({ status: "discarded", extraction_enc: null, qr_payload_enc: null }).eq("id", scanId);
  await removeFiles(user.id, [scan.front_path, scan.back_path, scan.thumb_path]);
  revalidatePath("/review");
  return { ok: true, nextScanId: await nextNeedsReview(scanId) };
}

/** Re-read a card with the stronger model, or retry one that failed. */
export async function rereadScan(scanId: string, { strong = true }: { strong?: boolean } = {}): Promise<ActionResult> {
  const user = await requireUser();
  if (!(await rateLimit("review", user.id)).success) return { ok: false, message: "Slow down a little and try again." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scans")
    .update({ status: "uploaded", attempts: 0, error: null })
    .eq("id", scanId)
    .in("status", ["needs_review", "failed"])
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, message: "This card can't be re-read right now." };

  after(() => processScan(scanId, { forceStrong: strong }));
  revalidatePath("/review");
  return { ok: true, nextScanId: null };
}
