import "server-only";
import { createHmac } from "node:crypto";
import { blindIndexKey, deriveKey } from "@/lib/crypto/keys";

export type IdentifierKind = "email" | "phone";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Keyed fingerprint of an identifier, scoped to one user so the same email
 * stored by two users produces unrelated values.
 */
export function blindIndex(userId: string, kind: IdentifierKind, normalizedValue: string): string {
  return createHmac("sha256", blindIndexKey()).update(`${userId}|${kind}|${normalizedValue}`).digest("base64url");
}

let ipKey: Buffer | undefined;

/** Pseudonymous IP fingerprint for the audit log and rate limits. */
export function hashIp(ip: string): string {
  ipKey ??= deriveKey(blindIndexKey(), "ip-hash");
  return createHmac("sha256", ipKey).update(ip).digest("base64url").slice(0, 22);
}
