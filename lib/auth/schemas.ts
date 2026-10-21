import { z } from "zod";

export const PASSWORD_MIN = 12;

export const emailSchema = z.email("Enter a valid email address").max(254).transform((v) => v.trim().toLowerCase());

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(128, "Use at most 128 characters");

export const captchaSchema = z.string().max(4096).optional().default("");

export const signUpSchema = z.object({
  displayName: z.string().trim().max(80).optional().default(""),
  email: emailSchema,
  password: newPasswordSchema,
  captchaToken: captchaSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(128),
  captchaToken: captchaSchema,
  next: z.string().max(512).optional(),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  captchaToken: captchaSchema,
});

export const resetPasswordSchema = z
  .object({ password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });

export const totpCodeSchema = z.string().regex(/^\d{6}$/, "Enter the 6-digit code");

/** Shape returned by every auth form action. */
export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echoed back so fields keep their values after a failed submit (never passwords). */
  values?: Record<string, string>;
  /** Incremented on every submit; used to refresh single-use captcha tokens. */
  attempt?: number;
};

export function toFieldErrors(error: z.ZodError): FormState["fieldErrors"] {
  return z.flattenError(error).fieldErrors as FormState["fieldErrors"];
}
