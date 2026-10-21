import "server-only";
import type { NormalizedCard, Validation } from "@/lib/ai/validate";
import { ExtractionFailedError, extractCard } from "@/lib/ai/extract";
import { globalBudgetExceeded, recordUsage, releaseQuota } from "@/lib/ai/metering";
import { parseQrPayload } from "@/lib/ai/qr";
import { openField, sealJson } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { prepareForModel } from "@/lib/images";
import { getDecrypted } from "@/lib/storage";
import { adminClient } from "@/lib/supabase/admin";
import { fromBytea, toBytea } from "@/lib/supabase/bytea";

export const MAX_ATTEMPTS = 3;

/** What is stored (encrypted) on the scan for the review screen. */
export type StoredExtraction = {
  card: NormalizedCard;
  validation: Validation;
  qrUrl?: string;
};

export const scanField = (userId: string, scanId: string, column: string) => ({ userId, table: "scans", column, rowId: scanId });

/**
 * Reads one scan's card with AI and stores the result for review. Safe to call
 * more than once: `claim_scan` lets exactly one caller work on a scan at a time.
 */
export async function processScan(scanId: string, { forceStrong = false } = {}): Promise<void> {
  const db = adminClient();
  const { data: claimed, error: claimError } = await db.rpc("claim_scan", { p_scan_id: scanId });
  if (claimError) throw claimError;
  const scan = claimed?.[0];
  if (!scan) return; // already done, being worked on, or out of attempts

  const userId = scan.user_id;
  try {
    if (await globalBudgetExceeded()) {
      // Leave it queued; the sweeper retries once the daily budget resets.
      await db.from("scans").update({ status: "uploaded", attempts: scan.attempts - 1, error: "AI is paused for today" }).eq("id", scanId);
      return;
    }

    const dek = await getUserDataKey(userId);
    const [front, back, profile] = await Promise.all([
      getDecrypted(userId, scan.front_path),
      scan.back_path ? getDecrypted(userId, scan.back_path) : Promise.resolve(null),
      db.from("profiles").select("phone_region").eq("id", userId).maybeSingle(),
    ]);

    const qrText = scan.qr_payload_enc
      ? openField(dek, fromBytea(scan.qr_payload_enc), scanField(userId, scanId, "qr_payload_enc")).toString("utf8")
      : null;
    const qr = qrText ? parseQrPayload(qrText) : null;

    const images = await Promise.all([front, back].filter((b): b is Buffer => b !== null).map(prepareForModel));

    const result = await extractCard(images, { defaultRegion: profile.data?.phone_region ?? undefined, qr, forceStrong });
    await recordUsage(userId, result.usage);

    const stored: StoredExtraction = { card: result.card, validation: result.validation, qrUrl: qr?.url };
    const { error } = await db
      .from("scans")
      .update({
        status: "needs_review",
        extraction_enc: toBytea(sealJson(dek, stored, scanField(userId, scanId, "extraction_enc"))),
        validation: { issues: result.validation.issues, escalated: result.escalated, isBusinessCard: result.card.isBusinessCard },
        model_used: result.modelUsed,
        error: null,
      })
      .eq("id", scanId);
    if (error) throw error;
  } catch (err) {
    if (err instanceof ExtractionFailedError) await recordUsage(userId, err.usage);
    const finalAttempt = scan.attempts >= MAX_ATTEMPTS;
    console.error(`[scan] ${scanId} attempt ${scan.attempts} failed:`, err instanceof Error ? err.message : err);
    await db
      .from("scans")
      .update({
        status: finalAttempt ? "failed" : "uploaded",
        error: finalAttempt ? "We couldn't read this card. Try a clearer photo." : "Retrying…",
      })
      .eq("id", scanId);
    if (finalAttempt) await releaseQuota(userId, "scan");
  }
}

/**
 * Picks up scans that were never processed (tab closed, server restarted) or
 * whose worker died. Runs on review-page load and from cron.
 */
export async function sweepScans({ userId, limit = 10 }: { userId?: string; limit?: number } = {}) {
  const db = adminClient();
  const staleBefore = new Date(Date.now() - 2 * 60_000).toISOString();
  const queuedBefore = new Date(Date.now() - 20_000).toISOString();

  let query = db
    .from("scans")
    .select("id")
    .lt("attempts", MAX_ATTEMPTS)
    .or(`and(status.eq.uploaded,updated_at.lt.${queuedBefore}),and(status.eq.processing,claimed_at.lt.${staleBefore})`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) throw error;

  // Small, bounded concurrency.
  const ids = (data ?? []).map((r) => r.id);
  for (let i = 0; i < ids.length; i += 3) {
    await Promise.all(ids.slice(i, i + 3).map((id) => processScan(id)));
  }
  return ids.length;
}
