import { NextResponse, type NextRequest } from "next/server";
import { getAuthorizedUser } from "@/lib/auth/dal";
import { getContactDetail } from "@/lib/contacts/queries";
import { toVCard } from "@/lib/export/vcard";

/** One contact as a .vcf file, to save straight into a phone's contacts. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/contacts/[id]/vcard">) {
  const user = await getAuthorizedUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const c = await getContactDetail(user.id, id);
  if (!c) return new NextResponse("Not found", { status: 404 });

  const vcf = toVCard({
    fullName: c.fullName,
    title: c.title,
    company: c.company?.name,
    emails: c.emails,
    phones: c.phones,
    website: c.website,
    address: c.address,
  });
  const filename = c.fullName.replace(/[^\p{L}\p{N} ._-]/gu, "").trim() || "contact";
  return new NextResponse(vcf, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.vcf"; filename*=UTF-8''${encodeURIComponent(filename)}.vcf`,
      "Cache-Control": "private, no-store",
    },
  });
}
