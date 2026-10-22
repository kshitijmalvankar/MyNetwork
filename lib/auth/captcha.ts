import "server-only";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Cloudflare's published test secrets: 1x… always passes, 2x… always fails, 3x… reports a reused token. */
const TEST_SECRET = /^[1-3]x0+AA$/;

export type CaptchaResult = "ok" | "missing" | "failed";

/**
 * Checks a Turnstile token with Cloudflare, on the server. Each environment
 * has its own secret: Cloudflare's test secret on laptops and in the
 * end-to-end tests, the real one on Vercel. Fails closed: a missing secret, a
 * test secret in production, or Cloudflare being unreachable all count as a
 * failed check. Tokens are single-use, so nothing else may verify them after this.
 */
export async function verifyCaptcha(token: string, ip?: string): Promise<CaptchaResult> {
  if (!token) return "missing";
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[captcha] TURNSTILE_SECRET_KEY is not set");
    return "failed";
  }
  if (process.env.VERCEL_ENV === "production" && TEST_SECRET.test(secret)) {
    console.error("[captcha] TURNSTILE_SECRET_KEY is Cloudflare's test secret, which lets every bot through. Set the real one.");
    return "failed";
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, cache: "no-store", signal: AbortSignal.timeout(8_000) });
    const result = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (result.success === true) return "ok";
    console.warn("[captcha] rejected:", result["error-codes"]?.join(", ") || `HTTP ${res.status}`);
    return "failed";
  } catch (err) {
    console.error("[captcha] couldn't reach Cloudflare:", err instanceof Error ? err.message : err);
    return "failed";
  }
}

/** What to tell the user when the check doesn't pass. */
export const captchaMessage = (result: Exclude<CaptchaResult, "ok">) =>
  result === "missing"
    ? "The security check hasn't finished yet. Wait a moment, then try again."
    : "The security check failed. Please try again.";
