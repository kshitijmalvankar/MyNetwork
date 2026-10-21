import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { searchContacts } from "@/lib/contacts/queries";

/** Quick people search for the ⌘K menu. */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ contacts: [] }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
  if (!q || q.length < 2) return NextResponse.json({ contacts: [] });

  const { rows } = await searchContacts({ q, sort: "relevance" }, { limit: 8 });
  return NextResponse.json(
    {
      contacts: rows.map((r) => ({
        id: r.id,
        name: r.fullName,
        subtitle: [r.title, r.companyName].filter(Boolean).join(" · ") || null,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
