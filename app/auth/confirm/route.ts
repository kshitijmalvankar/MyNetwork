import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

/**
 * Landing point for links in auth emails. Supports both the token-hash form
 * (works on any device) and the PKCE code form (same browser only).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") as EmailOtpType | null;
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");
  const isRecovery = type === "recovery" || searchParams.get("next") === "/reset-password";
  const next = isRecovery ? "/reset-password" : safeNext(searchParams.get("next"));

  const supabase = await createClient();
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (tokenHash && type && OTP_TYPES.has(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    return error ? to("/login?notice=link") : to(next);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return to(next);
    // Opened on a different device than the one that signed up: the email is
    // confirmed, but there is no session here yet.
    return to(isRecovery ? "/login?notice=link" : "/login?notice=confirmed");
  }

  // Supabase redirects here with an error description when the link is invalid or expired.
  return to("/login?notice=link");
}
