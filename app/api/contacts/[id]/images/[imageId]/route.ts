import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/dal";
import { getDecrypted } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

/** A saved card photo, decrypted for its owner. `?size=thumb` for the small version. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/contacts/[id]/images/[imageId]">) {
  const user = await getSessionUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id, imageId } = await params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(imageId).success) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data: img } = await supabase
    .from("card_images")
    .select("path, thumb_path")
    .eq("id", imageId)
    .eq("contact_id", id)
    .maybeSingle();
  const path = request.nextUrl.searchParams.get("size") === "thumb" && img?.thumb_path ? img.thumb_path : img?.path;
  if (!path) return new NextResponse(null, { status: 404 });

  try {
    const bytes = await getDecrypted(user.id, path);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
