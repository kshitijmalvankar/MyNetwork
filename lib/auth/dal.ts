import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string;
  aal: "aal1" | "aal2";
};

/** The verified signed-in user for this request, or null. Deduplicated per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return {
    id: claims.sub,
    email: String(claims.email ?? ""),
    aal: claims.aal === "aal2" ? "aal2" : "aal1",
  };
});

/**
 * Use at the top of every protected page, action and route handler. Also
 * enforces the second factor for users who enrolled one.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.aal !== "aal2") {
    const supabase = await createClient();
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.nextLevel === "aal2") redirect("/mfa");
  }
  return user;
}

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, timezone, phone_region")
    .eq("id", userId)
    .maybeSingle();
  return data;
});
