import "server-only";
import { blindIndex, normalizeEmail } from "@/lib/crypto/blind-index";
import { createClient } from "@/lib/supabase/server";

export type DuplicateCandidate = { id: string; fullName: string; company: string | null; reason: "email" | "phone" | "name" };

/**
 * Existing contacts that look like the same person: a shared email or phone
 * (matched by blind index, without decrypting anything) or the same name at
 * the same company.
 */
export async function findDuplicates(
  userId: string,
  { emails, phones, fullName, companyNormalized }: { emails: string[]; phones: string[]; fullName: string; companyNormalized?: string },
): Promise<DuplicateCandidate[]> {
  const supabase = await createClient();
  const found = new Map<string, DuplicateCandidate["reason"]>();

  const indexes = [
    ...emails.map((e) => ({ kind: "email" as const, idx: blindIndex(userId, "email", normalizeEmail(e)) })),
    ...phones.filter((p) => p.startsWith("+")).map((p) => ({ kind: "phone" as const, idx: blindIndex(userId, "phone", p) })),
  ];
  if (indexes.length) {
    const { data } = await supabase
      .from("contact_identifiers")
      .select("contact_id, kind")
      .in(
        "blind_index",
        indexes.map((i) => i.idx),
      );
    for (const row of data ?? []) if (!found.has(row.contact_id)) found.set(row.contact_id, row.kind as "email" | "phone");
  }

  if (fullName.trim()) {
    const { data } = await supabase
      .from("contacts")
      .select("id, companies(normalized_name)")
      .ilike("full_name", fullName.trim().replace(/[\\%_]/g, (c) => `\\${c}`))
      .limit(10);
    for (const row of data ?? []) {
      const company = (row.companies as { normalized_name: string } | null)?.normalized_name;
      if (!companyNormalized || !company || company === companyNormalized) {
        if (!found.has(row.id)) found.set(row.id, "name");
      }
    }
  }

  if (found.size === 0) return [];
  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, companies(name)")
    .in("id", [...found.keys()]);
  return (contacts ?? []).map((c) => ({
    id: c.id,
    fullName: c.full_name,
    company: (c.companies as { name: string } | null)?.name ?? null,
    reason: found.get(c.id)!,
  }));
}
