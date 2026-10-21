// Shared setup for live evals that read the seeded test account.
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// The real keys are needed to read the seeded (encrypted) data; the unit-test
// config sets throwaway ones.
Object.assign(process.env, parseEnv(readFileSync(".env.local", "utf8")));

export async function signInTestUser() {
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL!,
    password: process.env.E2E_TEST_PASSWORD!,
    // Turnstile's documented always-pass test token (only works with test keys).
    options: { captchaToken: "XXXX.DUMMY.TOKEN.XXXX" },
  });
  if (error) throw new Error(`Test sign-in failed: ${error.message}. Run pnpm seed:dev and pnpm seed:network first.`);
  return { supabase, userId: data.user.id };
}
