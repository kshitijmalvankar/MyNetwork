import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { getDecrypted } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const TYPES: Record<string, string> = { m4a: "audio/mp4", ogg: "audio/ogg" };

/** A voice note's recording, decrypted for its owner. Supports range requests, which Safari needs to play audio. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/notes/[id]/audio">) {
  const user = await getAuthorizedUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data: note } = await supabase.from("notes").select("audio_path").eq("id", id).maybeSingle();
  if (!note?.audio_path) return new NextResponse(null, { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await getDecrypted(user.id, note.audio_path);
  } catch {
    return new NextResponse(null, { status: 404 });
  }

  const headers = {
    "Content-Type": TYPES[note.audio_path.split(".").pop() ?? ""] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const size = bytes.length;
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    return new NextResponse(new Uint8Array(bytes.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new NextResponse(new Uint8Array(bytes), { headers: { ...headers, "Content-Length": String(bytes.length) } });
}
