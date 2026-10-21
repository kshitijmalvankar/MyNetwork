import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

let admin: SupabaseClient<Database> | undefined;

/**
 * Service-role client. Bypasses RLS, so it is only for server-owned data:
 * encryption keys, the audit log, metering, cron jobs and account deletion,
 * plus background jobs that run without a session (card reading, indexing),
 * which must always filter by the owning user_id themselves.
 * Never use it for request-time reads or writes of a user's own content.
 */
export function adminClient(): SupabaseClient<Database> {
  admin ??= createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return admin;
}
