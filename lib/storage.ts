import "server-only";
import { openField, sealField } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { adminClient } from "@/lib/supabase/admin";

const BUCKET = "vault";

/**
 * Files are encrypted with the owner's data key before upload, bound to their
 * path, so the bucket only ever holds ciphertext. Paths always start with the
 * owner's user id (also enforced by storage RLS).
 */
function assertOwnedPath(userId: string, path: string) {
  if (!path.startsWith(`${userId}/`) || path.includes("..")) throw new Error("Invalid storage path");
}

const fileContext = (userId: string, path: string) => ({ userId, table: "storage", column: BUCKET, rowId: path });

export async function putEncrypted(userId: string, path: string, bytes: Buffer) {
  assertOwnedPath(userId, path);
  const dek = await getUserDataKey(userId);
  const { error } = await adminClient()
    .storage.from(BUCKET)
    .upload(path, sealField(dek, bytes, fileContext(userId, path)), { contentType: "application/octet-stream", upsert: true });
  if (error) throw error;
}

export async function getDecrypted(userId: string, path: string): Promise<Buffer> {
  assertOwnedPath(userId, path);
  const { data, error } = await adminClient().storage.from(BUCKET).download(path);
  if (error) throw error;
  const dek = await getUserDataKey(userId);
  return openField(dek, Buffer.from(await data.arrayBuffer()), fileContext(userId, path));
}

export async function removeFiles(userId: string, paths: (string | null | undefined)[]) {
  const owned = paths.filter((p): p is string => Boolean(p));
  owned.forEach((p) => assertOwnedPath(userId, p));
  if (owned.length === 0) return;
  const { error } = await adminClient().storage.from(BUCKET).remove(owned);
  if (error) console.error("[storage] remove failed", error.message);
}
