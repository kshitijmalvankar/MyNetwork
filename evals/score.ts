import { normalizeCompanyName, type NormalizedCard } from "@/lib/ai/validate";

/** Expected values for a fixture. Arrays on scalar fields mean "any of these is right". */
export type Expected = {
  fullName: string;
  nameNative?: string;
  title?: string;
  company?: string;
  emails?: string[];
  phones?: string[];
  website?: string;
  city?: string;
  country?: string;
  roleFamily?: string | string[];
  seniority?: string | string[];
  language?: string;
};

const loose = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/^(dr|mr|mrs|ms|prof)\.?\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");

const anyOf = (actual: string | null | undefined, expected: string | string[]) =>
  (Array.isArray(expected) ? expected : [expected]).some((e) => loose(e) === loose(actual));

export type FieldScore = { field: string; ok: boolean; got: unknown; want: unknown };

export function scoreCard(card: NormalizedCard, want: Expected): FieldScore[] {
  const scores: FieldScore[] = [];
  const check = (field: string, ok: boolean, got: unknown, wantValue: unknown) => scores.push({ field, ok, got, want: wantValue });

  check("fullName", loose(card.fullName) === loose(want.fullName), card.fullName, want.fullName);
  if (want.nameNative) check("nameNative", loose(card.nameNative) === loose(want.nameNative), card.nameNative, want.nameNative);
  if (want.title) check("title", loose(card.title) === loose(want.title), card.title, want.title);
  if (want.company)
    check("company", normalizeCompanyName(card.company ?? "") === normalizeCompanyName(want.company), card.company, want.company);
  if (want.emails) {
    const got = new Set(card.emails);
    check("emails", want.emails.every((e) => got.has(e)) && got.size === want.emails.length, card.emails, want.emails);
  }
  if (want.phones) {
    const got = new Set(card.phoneNumbers);
    check("phones", want.phones.every((p) => got.has(p)), card.phoneNumbers, want.phones);
  }
  if (want.website) check("website", card.website === want.website, card.website, want.website);
  if (want.city) check("city", loose(card.city) === loose(want.city), card.city, want.city);
  if (want.country) check("country", card.country === want.country, card.country, want.country);
  if (want.roleFamily) check("roleFamily", anyOf(card.roleFamily, want.roleFamily), card.roleFamily, want.roleFamily);
  if (want.seniority) check("seniority", anyOf(card.seniority, want.seniority), card.seniority, want.seniority);
  return scores;
}
