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
 * True when the user has a verified authenticator but this session hasn't
 * passed it yet. Checked by the database from the signed JWT and
 * auth.mfa_factors (never from cookie contents); fails closed on error.
 */
export const secondFactorPending = cache(async (): Promise<boolean> => {
  const user = await getSessionUser();
  if (!user || user.aal === "aal2") return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mfa_required");
  if (error) throw error;
  return Boolean(data);
});

/**
 * Use at the top of every protected page and server action. Also enforces the
 * second factor for users who enrolled one (the database enforces it too).
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (await secondFactorPending()) redirect("/mfa");
  return user;
}

/** For route handlers: the user, or null if signed out or still owing a second factor. */
export async function getAuthorizedUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || (await secondFactorPending())) return null;
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
