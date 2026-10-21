import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/dal";
import { hasRecentStepUp } from "@/lib/auth/step-up";
import { openField, openJson } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { toCsv } from "@/lib/export/csv";
import { rateLimit } from "@/lib/ratelimit";
import { fromBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";

/** Every contact as CSV, decrypted. Requires a recent identity check and is audited. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  if (!(await hasRecentStepUp(user.id))) return new NextResponse("Please confirm it's you first.", { status: 403 });
  if (!(await rateLimit("export", user.id)).success) return new NextResponse("Too many exports. Try again later.", { status: 429 });

  const supabase = await createClient();
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select(
      "id, full_name, name_native, title, role_family, seniority, industry_override, website, city, country, emails_enc, phones_enc, address_enc, created_at, last_contacted_at, companies(name, industry), interactions(occurred_at, events(name))",
    )
    .order("full_name");
  if (error) return new NextResponse("Export failed", { status: 500 });

  const dek = await getUserDataKey(user.id);
  const ctx = (id: string, column: string) => ({ userId: user.id, table: "contacts", column, rowId: id });

  const rows = contacts.map((c) => {
    const company = c.companies as { name: string; industry: string | null } | null;
    const events = [...new Set((c.interactions ?? []).map((i) => (i.events as { name: string } | null)?.name).filter(Boolean))];
    return [
      c.full_name,
      c.name_native,
      c.title,
      company?.name,
      c.industry_override ?? company?.industry,
      c.role_family,
      c.seniority,
      c.emails_enc ? openJson<string[]>(dek, fromBytea(c.emails_enc), ctx(c.id, "emails_enc")).join("; ") : "",
      c.phones_enc ? openJson<string[]>(dek, fromBytea(c.phones_enc), ctx(c.id, "phones_enc")).join("; ") : "",
      c.website,
      c.address_enc ? openField(dek, fromBytea(c.address_enc), ctx(c.id, "address_enc")).toString("utf8") : "",
      c.city,
      c.country,
      events.join("; "),
      c.created_at.slice(0, 10),
      c.last_contacted_at?.slice(0, 10),
    ];
  });

  const csv = toCsv(
    ["Name", "Name (original script)", "Title", "Company", "Industry", "Role", "Seniority", "Emails", "Phones", "Website", "Address", "City", "Country", "Events", "Added", "Last contacted"],
    rows,
  );
  await audit({ userId: user.id, action: "data.export", metadata: { format: "csv", contacts: rows.length } });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mynetwork-contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
