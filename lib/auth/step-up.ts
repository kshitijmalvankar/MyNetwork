import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { deriveKey, masterKey } from "@/lib/crypto/keys";

const COOKIE = "mn_stepup";
export const STEP_UP_TTL_SECONDS = 5 * 60;

let signingKey: Buffer | undefined;
const key = () => (signingKey ??= deriveKey(masterKey(), "step-up-cookie"));

function sign(userId: string, expiresAt: number) {
  return createHmac("sha256", key()).update(`${userId}.${expiresAt}`).digest("base64url");
}

/** Record that the user just re-proved their identity (password, plus TOTP when enrolled). */
export async function markSteppedUp(userId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + STEP_UP_TTL_SECONDS;
  (await cookies()).set(COOKIE, `${expiresAt}.${sign(userId, expiresAt)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: STEP_UP_TTL_SECONDS,
  });
}

/** True when the user re-authenticated within the last few minutes. */
export async function hasRecentStepUp(userId: string): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [exp, mac] = value.split(".");
  const expiresAt = Number(exp);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() / 1000 || !mac) return false;
  const expected = Buffer.from(sign(userId, expiresAt));
  const actual = Buffer.from(mac);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function clearStepUp() {
  (await cookies()).delete(COOKIE);
}
