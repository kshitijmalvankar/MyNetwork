import "server-only";
import { cache } from "react";
import { currentMasterKeyVersion } from "@/lib/crypto/keys";
import { generateDataKey, unwrapDataKey, wrapDataKey } from "@/lib/crypto/envelope";
import { adminClient } from "@/lib/supabase/admin";
import { fromBytea, toBytea } from "@/lib/supabase/bytea";

/**
 * The user's data encryption key, unwrapped once per request. Created on
 * first use, so it also covers accounts that predate key creation at sign-up.
 */
export const getUserDataKey = cache(async (userId: string): Promise<Buffer> => {
  const db = adminClient();
  const { data, error } = await db.from("user_keys").select("wrapped_dek, key_version").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return unwrapDataKey(fromBytea(data.wrapped_dek), userId, data.key_version);

  const version = currentMasterKeyVersion();
  const dek = generateDataKey();
  const { error: insertError } = await db
    .from("user_keys")
    .insert({ user_id: userId, wrapped_dek: toBytea(wrapDataKey(dek, userId, version)), key_version: version });

  // Lost a race with a concurrent request: use the key that won.
  if (insertError?.code === "23505") return getUserDataKeyUncached(userId);
  if (insertError) throw insertError;
  return dek;
});

async function getUserDataKeyUncached(userId: string): Promise<Buffer> {
  const { data, error } = await adminClient()
    .from("user_keys")
    .select("wrapped_dek, key_version")
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  return unwrapDataKey(fromBytea(data.wrapped_dek), userId, data.key_version);
}
