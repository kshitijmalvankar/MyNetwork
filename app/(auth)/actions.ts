"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { audit } from "@/lib/audit";
import { pwnedCount } from "@/lib/auth/pwned";
import { safeNext } from "@/lib/auth/routes";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
  totpCodeSchema,
  type FormState,
} from "@/lib/auth/schemas";
import { hashForRateLimit } from "@/lib/crypto/blind-index";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { publicEnv } from "@/lib/env";
import { rateLimit } from "@/lib/ratelimit";
import { getRequestInfo } from "@/lib/request";
import { createClient } from "@/lib/supabase/server";

const TOO_MANY: FormState = { message: "Too many attempts. Please wait a few minutes and try again." };
const BREACHED =
  "This password has appeared in a known data breach. Please choose a different one.";

function authMessage(error: AuthError, fallback: string): string {
  switch (error.code) {
    case "captcha_failed":
      return "The security check failed. Please try again.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return TOO_MANY.message!;
    case "weak_password":
      return "That password is too weak. Try a longer one.";
    default:
      return fallback;
  }
}

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  const values = { displayName: String(formData.get("displayName") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };
  const { displayName, email, password, captchaToken } = parsed.data;

  const { ipHash } = await getRequestInfo();
  if (!(await rateLimit("signup", ipHash)).success) return { ...TOO_MANY, values };

  if ((await pwnedCount(password)) > 0) return { fieldErrors: { password: [BREACHED] }, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/home`,
      data: displayName ? { display_name: displayName } : undefined,
      captchaToken: captchaToken || undefined,
    },
  });
  if (error) {
    console.warn("[auth] sign-up failed:", error.code ?? error.status);
    if (error.code === "email_address_invalid") return { fieldErrors: { email: ["Enter a real email address"] }, values };
    // Only returned while email confirmation is off; with it on, Supabase hides whether the email exists.
    if (error.code === "user_already_exists" || error.code === "email_exists") {
      return { fieldErrors: { email: ["An account with this email already exists. Sign in instead."] }, values };
    }
    return { message: authMessage(error, "We couldn't create your account. Please try again."), values };
  }

  // With confirmation on, an existing email comes back as a user with no identities. Treat both the same.
  const user = data.user;
  if (user && user.identities && user.identities.length > 0) {
    await getUserDataKey(user.id);
    await audit({ userId: user.id, action: "auth.signup" });
  }

  // Email confirmation off: Supabase signs the user in straight away.
  // Email confirmation on: no session until the link in the email is clicked.
  if (data.session) redirect("/home");
  redirect("/verify-email");
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };
  const { email, password, captchaToken, next } = parsed.data;

  const { ipHash } = await getRequestInfo();
  const [perAccount, perIp] = await Promise.all([
    rateLimit("login", `${ipHash}:${hashForRateLimit(email)}`),
    rateLimit("loginIp", ipHash),
  ]);
  if (!perAccount.success || !perIp.success) return { ...TOO_MANY, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: { captchaToken: captchaToken || undefined },
  });

  if (error) {
    await audit({ userId: null, action: "auth.login_failed", metadata: { reason: error.code ?? "unknown" } });
    if (error.code === "email_not_confirmed") {
      return { message: "Please confirm your email first. Check your inbox for the link.", values };
    }
    return { message: authMessage(error, "Incorrect email or password."), values };
  }

  await audit({ userId: data.user.id, action: "auth.login" });

  // Verified by the database (signed JWT + auth.mfa_factors), not the cookie.
  const { data: needsCode } = await supabase.rpc("mfa_required");
  const destination = safeNext(next);
  if (needsCode !== false) {
    redirect(`/mfa?next=${encodeURIComponent(destination)}`);
  }
  redirect(destination);
}

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  const values = { email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error), values };
  const { email, captchaToken } = parsed.data;

  const { ipHash } = await getRequestInfo();
  const [perEmail, perIp] = await Promise.all([
    rateLimit("passwordReset", hashForRateLimit(email)),
    rateLimit("passwordReset", ipHash),
  ]);
  if (!perEmail.success || !perIp.success) return { ...TOO_MANY, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/reset-password`,
    captchaToken: captchaToken || undefined,
  });
  if (error?.code === "captcha_failed") return { message: authMessage(error, ""), values };

  await audit({ userId: null, action: "auth.password_reset_requested" });
  // Same answer whether or not the account exists.
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." };
}

export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  if ((await pwnedCount(parsed.data.password)) > 0) return { fieldErrors: { password: [BREACHED] } };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      message:
        error.code === "same_password"
          ? "That's your current password. Choose a new one."
          : authMessage(error, "We couldn't update your password. Please try again."),
    };
  }
  await audit({ userId, action: "auth.password_changed", metadata: { via: "reset" } });
  redirect("/home");
}

export async function verifyMfa(_prev: FormState, formData: FormData): Promise<FormState> {
  const code = totpCodeSchema.safeParse(formData.get("code"));
  if (!code.success) return { fieldErrors: { code: ["Enter the 6-digit code"] } };
  const factorId = String(formData.get("factorId") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  if (!(await rateLimit("mfa", userId)).success) return TOO_MANY;

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.id === factorId) ?? factors?.totp[0];
  if (!factor) redirect(next);

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.data });
  if (error) {
    await audit({ userId, action: "auth.mfa_failed" });
    return { fieldErrors: { code: ["That code didn't work. Check your authenticator and try again."] } };
  }
  await audit({ userId, action: "auth.mfa_verified" });
  redirect(next);
}
