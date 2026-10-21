import "server-only";
import { createHash } from "node:crypto";

/**
 * Checks a password against Have I Been Pwned using k-anonymity: only the
 * first five characters of its SHA-1 hash leave the server. Fails open
 * (returns 0) if the service is unreachable, so sign-up never hard-depends on it.
 */
export async function pwnedCount(password: string, fetchImpl: typeof fetch = fetch): Promise<number> {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "MyNetwork-password-check" },
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return 0;
    for (const line of (await res.text()).split("\n")) {
      const [candidate, count] = line.trim().split(":");
      if (candidate === suffix) return Number(count) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}
