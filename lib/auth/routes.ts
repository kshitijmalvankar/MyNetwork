/** Pages that need a signed-in user (and a second factor, when enrolled). */
export const PROTECTED_PREFIXES = [
  "/home",
  "/scan",
  "/review",
  "/contacts",
  "/ask",
  "/graph",
  "/events",
  "/insights",
  "/settings",
  "/reset-password",
];

/** Pages for signed-out visitors; signed-in users are sent to the app. */
export const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

export const MFA_PATH = "/mfa";

export function matchesPrefix(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Only allow same-site relative redirects (blocks `//evil.com` and `https://…`). */
export function safeNext(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
