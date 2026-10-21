// Re-indexes everything for Ask, e.g. after changing EMBEDDING_MODEL.
// Unchanged text is skipped, so it's cheap to re-run.
//
//   pnpm reindex
import { indexStale } from "@/lib/knowledge/indexer";
import { adminClient } from "@/lib/supabase/admin";

async function main() {
  const db = adminClient();
  const now = new Date().toISOString();
  for (const table of ["contacts", "events"] as const) {
    const { error } = await db.from(table).update({ index_requested_at: now }).not("id", "is", null);
    if (error) throw error;
  }
  let total = 0;
  for (;;) {
    const { indexed, failed } = await indexStale({ limit: 200 });
    total += indexed;
    if (failed) console.warn(`${failed} item(s) failed; they stay flagged for the next sweep.`);
    if (indexed === 0) break;
  }
  console.log(`Re-indexed ${total} item(s).`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
