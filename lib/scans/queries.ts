import "server-only";
import { openJson } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { fromBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";
import { scanField, type StoredExtraction } from "@/lib/scans/process";

export type QueueItem = {
  id: string;
  status: "uploaded" | "processing" | "needs_review" | "failed";
  createdAt: string;
  hasBack: boolean;
  name: string | null;
  subtitle: string | null;
  issues: number;
  error: string | null;
};

/** Cards waiting to be read or reviewed, newest first, with a decrypted preview. */
export async function getReviewQueue(userId: string): Promise<QueueItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scans")
    .select("id, status, created_at, back_path, extraction_enc, validation, error")
    .in("status", ["uploaded", "processing", "needs_review", "failed"])
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;

  const dek = data.some((s) => s.extraction_enc) ? await getUserDataKey(userId) : null;
  return data.map((s) => {
    let name: string | null = null;
    let subtitle: string | null = null;
    if (dek && s.extraction_enc) {
      try {
        const { card } = openJson<StoredExtraction>(dek, fromBytea(s.extraction_enc), scanField(userId, s.id, "extraction_enc"));
        name = card.fullName || null;
        subtitle = [card.title, card.company].filter(Boolean).join(" · ") || null;
      } catch {
        // unreadable preview: fall back to a generic label
      }
    }
    const validation = s.validation as { issues?: unknown[] } | null;
    return {
      id: s.id,
      status: s.status as QueueItem["status"],
      createdAt: s.created_at,
      hasBack: Boolean(s.back_path),
      name,
      subtitle,
      issues: validation?.issues?.length ?? 0,
      error: s.error,
    };
  });
}

export async function getScanForReview(userId: string, scanId: string) {
  const supabase = await createClient();
  const { data: scan } = await supabase
    .from("scans")
    .select("id, status, back_path, extraction_enc, validation, model_used, created_at")
    .eq("id", scanId)
    .maybeSingle();
  if (!scan || scan.status !== "needs_review" || !scan.extraction_enc) return null;
  const dek = await getUserDataKey(userId);
  const stored = openJson<StoredExtraction>(dek, fromBytea(scan.extraction_enc), scanField(userId, scanId, "extraction_enc"));
  return {
    id: scan.id,
    hasBack: Boolean(scan.back_path),
    modelUsed: scan.model_used,
    escalated: Boolean((scan.validation as { escalated?: boolean } | null)?.escalated),
    stored,
  };
}
