// Re-wraps every user's data key with the current master key, after rotating it.
// Only the small per-user keys change; encrypted contacts, notes and files don't.
//
//   1. Move the old key to APP_MASTER_KEY_V<old version>, put a new key in
//      APP_MASTER_KEY and increase APP_MASTER_KEY_VERSION.
//   2. Deploy with those values, so both versions can be read.
//   3. pnpm rotate:master-key           (counts keys per version, changes nothing)
//      pnpm rotate:master-key --apply   (re-wraps keys on older versions)
//   4. When nothing is left on an old version, remove APP_MASTER_KEY_V<old>.
import { unwrapDataKey, wrapDataKey } from "@/lib/crypto/envelope";
import { currentMasterKeyVersion } from "@/lib/crypto/keys";
import { adminClient } from "@/lib/supabase/admin";
import { fromBytea, toBytea } from "@/lib/supabase/bytea";

const BATCH = 200;

async function countByVersion() {
  const { data, error } = await adminClient().from("user_keys").select("key_version");
  if (error) throw error;
  const counts = new Map<number, number>();
  for (const row of data) counts.set(row.key_version, (counts.get(row.key_version) ?? 0) + 1);
  return counts;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const current = currentMasterKeyVersion();
  const before = await countByVersion();
  console.log(`Current master key version: ${current}`);
  for (const [version, n] of [...before].sort((a, b) => a[0] - b[0])) console.log(`  version ${version}: ${n} key(s)`);
  const stale = [...before].filter(([v]) => v !== current).reduce((sum, [, n]) => sum + n, 0);
  if (stale === 0) return console.log("Nothing to rotate.");
  if (!apply) return console.log(`${stale} key(s) would be re-wrapped. Run again with --apply to do it.`);

  const db = adminClient();
  let done = 0;
  for (;;) {
    const { data, error } = await db.from("user_keys").select("user_id, wrapped_dek, key_version").neq("key_version", current).limit(BATCH);
    if (error) throw error;
    if (data.length === 0) break;
    for (const row of data) {
      // Unwrap first: if an old master key is missing, stop before changing anything for this user.
      const dek = unwrapDataKey(fromBytea(row.wrapped_dek), row.user_id, row.key_version);
      const { error: updateError } = await db
        .from("user_keys")
        .update({ wrapped_dek: toBytea(wrapDataKey(dek, row.user_id, current)), key_version: current, rotated_at: new Date().toISOString() })
        .eq("user_id", row.user_id)
        .eq("key_version", row.key_version);
      if (updateError) throw updateError;
      done++;
    }
  }
  console.log(`Re-wrapped ${done} key(s) with version ${current}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
