"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createStatelessClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DELETE_CONFIRMATION } from "@/lib/account/confirm";
import { deleteAccountData } from "@/lib/account/delete";
import { audit } from "@/lib/audit";
import { captchaMessage, verifyCaptcha } from "@/lib/auth/captcha";
import { requireUser } from "@/lib/auth/dal";
import { pwnedCount } from "@/lib/auth/pwned";
import { captchaSchema, newPasswordSchema, toFieldErrors, totpCodeSchema, type FormState } from "@/lib/auth/schemas";
import { clearStepUp, hasRecentStepUp, markSteppedUp } from "@/lib/auth/step-up";
import { publicEnv } from "@/lib/env";
import { rateLimit } from "@/lib/ratelimit";
import { getRequestInfo } from "@/lib/request";
import { createClient } from "@/lib/supabase/server";

const TOO_MANY: FormState = { message: "Too many attempts. Please wait a few minutes and try again." };
const NEEDS_STEP_UP: FormState = { message: "Please confirm it's you first.", fieldErrors: { stepUp: ["required"] } };

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  displayName: z.string().trim().max(80),
  timezone: z.string().trim().min(1).max(64),
  phoneRegion: z.string().regex(/^[A-Z]{2}$/, "Pick a country"),
});

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  if (!Intl.supportedValuesOf("timeZone").includes(parsed.data.timezone) && parsed.data.timezone !== "UTC") {
    return { fieldErrors: { timezone: ["Unknown time zone"] } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName || null,
      timezone: parsed.data.timezone,
      phone_region: parsed.data.phoneRegion,
    })
    .eq("id", user.id);
  if (error) return { message: "Couldn't save your profile. Please try again." };

  revalidatePath("/", "layout");
  return { ok: true, message: "Profile saved." };
}

// ---------------------------------------------------------------------------
// Step-up: re-prove identity before sensitive changes
// ---------------------------------------------------------------------------

export async function stepUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await rateLimit("stepUp", user.id)).success) return TOO_MANY;

  const password = String(formData.get("password") ?? "");
  const captchaToken = captchaSchema.parse(formData.get("captchaToken") ?? "");
  if (!password) return { fieldErrors: { password: ["Enter your password"] } };
  const captcha = await verifyCaptcha(captchaToken, (await getRequestInfo()).ip);
  if (captcha !== "ok") return { message: captchaMessage(captcha) };

  // Check the password on a throwaway client so the user's current session
  // (and its second-factor level) is left untouched.
  const probe = createStatelessClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await probe.auth.signInWithPassword({ email: user.email, password });
  if (error || data.user?.id !== user.id) {
    await audit({ userId: user.id, action: "auth.login_failed", metadata: { reason: "step_up" } });
    return { fieldErrors: { password: ["That password isn't right."] } };
  }
  await probe.auth.signOut({ scope: "local" });

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp ?? [];
  if (totp.length > 0) {
    const code = totpCodeSchema.safeParse(formData.get("code"));
    if (!code.success) return { fieldErrors: { code: ["Enter the 6-digit code from your authenticator"] } };
    const factorId = String(formData.get("factorId") || totp[0].id);
    const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.data });
    if (mfaError) return { fieldErrors: { code: ["That code didn't work."] } };
  }

  await markSteppedUp(user.id);
  await audit({ userId: user.id, action: "auth.step_up" });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Password
// ---------------------------------------------------------------------------

const changePasswordSchema = z
  .object({ password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await hasRecentStepUp(user.id))) return NEEDS_STEP_UP;

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  if ((await pwnedCount(parsed.data.password)) > 0) {
    return { fieldErrors: { password: ["This password has appeared in a known data breach. Choose another."] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      message: error.code === "same_password" ? "That's your current password." : "Couldn't change your password. Please try again.",
    };
  }
  await audit({ userId: user.id, action: "auth.password_changed" });
  return { ok: true, message: "Password changed." };
}

// ---------------------------------------------------------------------------
// Two-factor authentication
// ---------------------------------------------------------------------------

export type EnrollResult = { ok: true; factorId: string; qrCode: string; secret: string } | { ok: false; message: string };

export async function startTotpEnrollment(friendlyName: string): Promise<EnrollResult> {
  const user = await requireUser();
  if (!(await hasRecentStepUp(user.id))) return { ok: false, message: NEEDS_STEP_UP.message! };

  const name = z.string().trim().min(1).max(40).safeParse(friendlyName);
  if (!name.success) return { ok: false, message: "Give this authenticator a short name." };

  const supabase = await createClient();
  // Clear abandoned, never-verified enrolments so names can be reused.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.all ?? []) {
    if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  if ((existing?.totp ?? []).some((f) => f.friendly_name === name.data)) {
    return { ok: false, message: "You already have an authenticator with that name." };
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: name.data, issuer: "MyNetwork" });
  if (error) return { ok: false, message: "Couldn't start setup. Please try again." };
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmTotpEnrollment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await rateLimit("mfa", user.id)).success) return TOO_MANY;
  const code = totpCodeSchema.safeParse(formData.get("code"));
  if (!code.success) return { fieldErrors: { code: ["Enter the 6-digit code"] } };
  const factorId = String(formData.get("factorId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.data });
  if (error) return { fieldErrors: { code: ["That code didn't work. Make sure your phone's clock is correct."] } };

  await audit({ userId: user.id, action: "auth.mfa_enrolled", targetType: "mfa_factor", targetId: factorId });
  revalidatePath("/settings/security");
  return { ok: true, message: "Authenticator added." };
}

export async function removeTotpFactor(factorId: string): Promise<FormState> {
  const user = await requireUser();
  if (!(await hasRecentStepUp(user.id))) return NEEDS_STEP_UP;

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { message: "Couldn't remove that authenticator. Please try again." };

  await audit({ userId: user.id, action: "auth.mfa_removed", targetType: "mfa_factor", targetId: factorId });
  revalidatePath("/settings/security");
  return { ok: true, message: "Authenticator removed." };
}

// ---------------------------------------------------------------------------
// Delete account and all data
// ---------------------------------------------------------------------------

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!(await hasRecentStepUp(user.id))) return NEEDS_STEP_UP;
  if (!(await rateLimit("deleteAccount", user.id)).success) return TOO_MANY;
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== DELETE_CONFIRMATION) {
    return { fieldErrors: { confirm: [`Type "${DELETE_CONFIRMATION}" to confirm`] } };
  }

  const supabase = await createClient();
  const { count } = await supabase.from("contacts").select("id", { count: "exact", head: true });

  const result = await deleteAccountData(user.id);
  if (!result.ok) {
    return {
      message:
        result.step === "files"
          ? "Couldn't delete your files, so nothing was deleted. Please try again."
          : "Your files were deleted, but your account couldn't be. Please try again.",
    };
  }

  // The user's own audit entries went with the account. Keep a record that it
  // was deleted, with no email or other details.
  await audit({
    userId: null,
    action: "account.deleted",
    targetType: "user",
    targetId: user.id,
    metadata: { contacts: count ?? 0, files: result.files },
  });
  await supabase.auth.signOut({ scope: "local" });
  await clearStepUp();
  redirect("/login?notice=account-deleted");
}
