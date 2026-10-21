import "server-only";
import { after } from "next/server";
import { askSuggestions } from "@/lib/ask/suggestions";
import { listThreads } from "@/lib/ask/threads";
import { getFacets } from "@/lib/contacts/queries";
import { indexBacklog, indexStale } from "@/lib/knowledge/indexer";
import { createClient } from "@/lib/supabase/server";

/** What both Ask pages need besides the conversation itself. */
export async function loadAskSidebar(userId: string) {
  const supabase = await createClient();
  const [threads, facets, backlog, { count }] = await Promise.all([
    listThreads(supabase, userId),
    getFacets(),
    indexBacklog(supabase),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
  ]);
  // Anything not yet searchable (e.g. people added before Ask existed) catches up in the background.
  if (backlog > 0) after(() => indexStale({ userId, limit: 200 }));
  return { threads, suggestions: askSuggestions(facets), backlog, hasContacts: (count ?? 0) > 0 };
}
