import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_ONLY, MFA_PATH, PROTECTED_PREFIXES, matchesPrefix } from "@/lib/auth/routes";
import { buildCsp } from "@/lib/security/csp";

const isDev = process.env.NODE_ENV === "development";

/**
 * Runs before every page and API request:
 *  1. issues a per-request CSP nonce,
 *  2. refreshes the Supabase session cookie,
 *  3. makes optimistic redirects (signed out → /login, signed in → away from sign-in pages).
 * Pages and APIs still verify the user themselves; this is not the security boundary.
 */
export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, supabaseUrl, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        requestHeaders.set("cookie", request.cookies.toString());
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // getClaims() verifies the JWT (and refreshes it when expired). Do not use getSession() here.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const { pathname, search } = request.nextUrl;
  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = params ? `?${new URLSearchParams(params)}` : "";
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    for (const key of ["cache-control", "expires", "pragma"]) {
      const value = response.headers.get(key);
      if (value) redirect.headers.set(key, value);
    }
    redirect.headers.set("Content-Security-Policy", csp);
    return redirect;
  };

  if (!signedIn && (matchesPrefix(pathname, PROTECTED_PREFIXES) || pathname === MFA_PATH)) {
    return redirectTo("/login", { next: pathname + search });
  }
  // Signed-in users skip the sign-in pages. Whether a second factor is still
  // owed is decided by requireUser() and the database, not here.
  if (signedIn && matchesPrefix(pathname, GUEST_ONLY)) {
    return redirectTo("/home");
  }

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
