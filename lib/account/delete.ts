import "server-only";
import { adminClient } from "@/lib/supabase/admin";

const BUCKET = "vault";
const PAGE = 1000;

/**
 * Every file under the user's folder (cards, thumbnails, voice notes), however
 * deep. A flat listing by prefix takes one request per 1000 files, where walking
 * folders would take one per scanned card.
 */
async function listUserFiles(userId: string): Promise<string[]> {
  const storage = adminClient().storage.from(BUCKET);
  const prefix = `${userId}/`;
  const files: string[] = [];
  let cursor: string | undefined;
  do {
    const { data, error } = await storage.listV2({ prefix, limit: PAGE, cursor });
    if (error) throw error;
    for (const object of data.objects) {
      const path = object.key ?? object.name;
      // Belt and braces: never touch anything outside this user's folder.
      if (path.startsWith(prefix)) files.push(path);
    }
    cursor = data.hasNext ? data.nextCursor : undefined;
  } while (cursor);
  return files;
}

export type DeleteResult = { ok: true; files: number } | { ok: false; step: "files" | "account" };

/**
 * Deletes the user's files, then the user. Every table row goes with the user
 * (foreign keys cascade), including their wrapped data key; copies in database
 * backups remain until those backups expire. Files go first: if that fails,
 * nothing else has been touched and the user can try again.
 */
export async function deleteAccountData(userId: string): Promise<DeleteResult> {
  let files: string[];
  try {
    files = await listUserFiles(userId);
    for (let i = 0; i < files.length; i += PAGE) {
      const { error } = await adminClient().storage.from(BUCKET).remove(files.slice(i, i + PAGE));
      if (error) throw error;
    }
  } catch (err) {
    console.error("[account] deleting files failed", err);
    return { ok: false, step: "files" };
  }

  const { error } = await adminClient().auth.admin.deleteUser(userId);
  if (error) {
    console.error("[account] deleting user failed", error.message);
    return { ok: false, step: "account" };
  }
  return { ok: true, files: files.length };
}
