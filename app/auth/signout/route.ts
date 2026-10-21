import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/audit";
import { clearStepUp } from "@/lib/auth/step-up";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // Same-origin form posts only.
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;

  await supabase.auth.signOut({ scope: "local" });
  await clearStepUp();
  if (userId) await audit({ userId, action: "auth.logout" });

  return NextResponse.redirect(new URL("/login?notice=signed-out", request.url), { status: 303 });
}
