import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/dal";
import { getDecrypted } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/** Streams a decrypted card image. Ownership is checked through RLS before decrypting. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/scans/[id]/image">) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });
  const side = request.nextUrl.searchParams.get("side") ?? "front";

  const supabase = await createClient();
  const { data: scan } = await supabase.from("scans").select("front_path, back_path, thumb_path").eq("id", id).maybeSingle();
  const path = side === "back" ? scan?.back_path : side === "thumb" ? scan?.thumb_path : scan?.front_path;
  if (!path) return new NextResponse(null, { status: 404 });

  try {
    const bytes = await getDecrypted(user.id, path);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
