import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/min";
import type { CardExtraction } from "@/lib/ai/card-schema";

/** Field-level problems. Messages never include the values themselves (they are stored unencrypted). */
export type FieldIssue = { field: string; message: string };

export type NormalizedCard = CardExtraction & {
  /** Emails, lower-cased and de-duplicated. */
  emails: string[];
  /** Phones in E.164 where parseable, otherwise as printed. */
  phoneNumbers: string[];
  website: string | null;
};

export type Validation = {
  issues: FieldIssue[];
  /** True when a stronger model should take another look. */
  shouldEscalate: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function normalizeWebsite(value: string | null | undefined): string | null {
  if (!value) return null;
  const host = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  return DOMAIN_RE.test(host) ? host : null;
}

export function normalizePhone(raw: string, defaultRegion?: string): string | null {
  const cleaned = raw.replace(/^(tel|phone|mobile|mob|m|t|p|f|fax)[\s.:]*/i, "").trim();
  const region = defaultRegion && /^[A-Z]{2}$/.test(defaultRegion) ? (defaultRegion as CountryCode) : undefined;
  const parsed = parsePhoneNumberFromString(cleaned, region);
  // isPossible (length/format) rather than isValid: number ranges change faster than bundled metadata.
  return parsed?.isPossible() ? parsed.number : null;
}

/** Company name reduced to a comparable key: "XYZ Technologies, Inc." → "xyz technologies". */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[.,()'"]/g, " ")
    .replace(/\b(inc|incorporated|llc|ltd|limited|co|corp|corporation|gmbh|ag|sa|plc|pvt|private|pte|kk|bv|srl|oy|ab)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministic checks on a model's reading of a card. These decide whether
 * to escalate to a stronger model, because a model's own confidence is not a
 * reliable signal on its own.
 */
export function normalizeAndValidate(card: CardExtraction, defaultRegion?: string): { card: NormalizedCard; validation: Validation } {
  const issues: FieldIssue[] = [];
  const region = card.country && /^[A-Z]{2}$/.test(card.country) ? card.country : defaultRegion;

  const emails = [...new Set(card.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  for (const e of emails) if (!EMAIL_RE.test(e)) issues.push({ field: "emails", message: "An email address doesn't look right" });

  const phoneNumbers: string[] = [];
  for (const p of card.phones) {
    const e164 = normalizePhone(p.number, region);
    if (e164) {
      if (!phoneNumbers.includes(e164)) phoneNumbers.push(e164);
    } else {
      phoneNumbers.push(p.number.trim());
      issues.push({ field: "phones", message: "A phone number couldn't be read" });
    }
  }

  const website = normalizeWebsite(card.website);
  if (card.website && !website) issues.push({ field: "website", message: "Website doesn't look valid" });

  const name = card.fullName.trim();
  if (!name) issues.push({ field: "fullName", message: "No name found" });
  else if (name.split(/\s+/).length > 6) issues.push({ field: "fullName", message: "Name looks too long" });
  if (card.company && name && normalizeCompanyName(card.company) === name.toLowerCase()) {
    issues.push({ field: "fullName", message: "Name and company are the same" });
  }

  if (card.country && !/^[A-Z]{2}$/.test(card.country)) issues.push({ field: "country", message: "Unknown country code" });

  const lowConfidence = (["fullName", "company", "title"] as const).filter((k) => card.confidence[k] === "low");
  const hardIssue = issues.some((i) => i.field === "fullName" || i.field === "emails" || i.field === "phones");

  return {
    card: { ...card, fullName: name, emails, phoneNumbers, website },
    validation: {
      issues,
      shouldEscalate: card.isBusinessCard && (hardIssue || lowConfidence.length > 0 || (emails.length === 0 && phoneNumbers.length === 0)),
    },
  };
}
