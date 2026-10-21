import { randomUUID } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { consumeQuota, releaseQuota } from "@/lib/ai/metering";
import { getSessionUser } from "@/lib/auth/dal";
import { sealField } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { MAX_UPLOAD_BYTES, prepareForStorage, UnsupportedImageError } from "@/lib/images";
import { decodeQr } from "@/lib/qr-decode";
import { rateLimit } from "@/lib/ratelimit";
import { processScan, scanField } from "@/lib/scans/process";
import { putEncrypted, removeFiles } from "@/lib/storage";
import { toBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

/** Upload one card (front, optional back). Responds once stored; reading happens in the background. */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return json({ error: "Please sign in again." }, 401);

  if (!(await rateLimit("upload", user.id)).success) {
    return json({ error: "You're uploading very quickly. Please wait a minute." }, 429);
  }

  const form = await request.formData().catch(() => null);
  const front = form?.get("front");
  const back = form?.get("back");
  const batchId = z.uuid().safeParse(form?.get("batchId")).data ?? null;
  if (!(front instanceof File)) return json({ error: "No image received." }, 400);
  for (const f of [front, back]) {
    if (f instanceof File && f.size > MAX_UPLOAD_BYTES) return json({ error: "That image is too large (max 6 MB)." }, 413);
  }

  const quota = await consumeQuota(user.id, "scan");
  if (!quota.allowed) {
    return json({ error: `You've used all ${quota.quota} scans for this month.`, code: "quota" }, 402);
  }

  const scanId = randomUUID();
  const base = `${user.id}/cards/${scanId}`;
  const paths = { front: `${base}/front`, back: back instanceof File ? `${base}/back` : null, thumb: `${base}/thumb` };

  try {
    const [frontImg, backImg] = await Promise.all([
      prepareForStorage(Buffer.from(await front.arrayBuffer())),
      back instanceof File ? prepareForStorage(Buffer.from(await back.arrayBuffer())) : Promise.resolve(null),
    ]);

    const qrText = (await decodeQr(frontImg.full)) ?? (backImg ? await decodeQr(backImg.full) : null);

    await Promise.all([
      putEncrypted(user.id, paths.front, frontImg.full),
      putEncrypted(user.id, paths.thumb, frontImg.thumb),
      backImg && paths.back ? putEncrypted(user.id, paths.back, backImg.full) : Promise.resolve(),
    ]);

    const dek = await getUserDataKey(user.id);
    const supabase = await createClient();
    const { error } = await supabase.from("scans").insert({
      id: scanId,
      user_id: user.id,
      batch_id: batchId,
      front_path: paths.front,
      back_path: paths.back,
      thumb_path: paths.thumb,
      qr_payload_enc: qrText ? toBytea(sealField(dek, qrText, scanField(user.id, scanId, "qr_payload_enc"))) : null,
    });
    if (error) throw error;
  } catch (err) {
    await releaseQuota(user.id, "scan");
    await removeFiles(user.id, Object.values(paths));
    if (err instanceof UnsupportedImageError) {
      return json({ error: "That file isn't a supported image. Use JPEG, PNG or WebP." }, 415);
    }
    console.error("[scans] upload failed", err instanceof Error ? err.message : err);
    return json({ error: "Upload failed. Please try again." }, 500);
  }

  after(() => processScan(scanId));
  return json({ id: scanId, remaining: quota.quota - quota.used }, 201);
}
