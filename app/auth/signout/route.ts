import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { clearStepUp } from "@/lib/auth/step-up";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Same-origin form posts only. Compare with the Host the browser used (as
  // Next.js does for server actions), not request.nextUrl, which can name a
  // different host behind a proxy or when the app is reached by IP address.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && URL.parse(origin)?.host !== host) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  await supabase.auth.signOut({ scope: "local" });
  await clearStepUp();
  if (userId) await audit({ userId, action: "auth.logout" });

  // A relative address, so the browser stays on whichever host it used.
  return new NextResponse(null, { status: 303, headers: { Location: "/login?notice=signed-out" } });
}
