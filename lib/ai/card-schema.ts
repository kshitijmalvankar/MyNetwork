import { z } from "zod";

export const ROLE_FAMILIES = [
  "Engineering",
  "Product",
  "Design",
  "Data",
  "Sales",
  "Marketing",
  "Finance",
  "Operations",
  "HR",
  "Legal",
  "Executive",
  "Founder",
  "Consulting",
  "Research",
  "Healthcare",
  "Education",
  "Other",
] as const;

export const SENIORITIES = ["Intern", "Junior", "Mid", "Senior", "Lead/Manager", "Director", "VP", "C-level/Founder"] as const;

export type RoleFamily = (typeof ROLE_FAMILIES)[number];
export type Seniority = (typeof SENIORITIES)[number];

const confidence = z.enum(["high", "medium", "low"]);

/** What the vision model returns for one card (front and back together). */
export const cardExtractionSchema = z.object({
  isBusinessCard: z.boolean().describe("False if the image is not a business card"),
  fullName: z
    .string()
    .describe("The person's name in Latin script. Transliterate if only another script is printed. Never translate names. Omit honorifics like Dr./Mr."),
  nameNative: z.string().nullable().describe("The name exactly as printed in a non-Latin script, if any"),
  title: z.string().nullable().describe("Job title in English (translate if needed)"),
  titleNative: z.string().nullable().describe("Job title as printed in a non-Latin script, if any"),
  company: z.string().nullable().describe("Company's own Latin-script name as printed, including suffixes like Ltd. or Inc."),
  emails: z.array(z.string()),
  phones: z.array(
    z.object({
      number: z.string().describe("As printed, including any country code"),
      kind: z.enum(["mobile", "work", "fax", "other"]),
    }),
  ),
  website: z.string().nullable(),
  address: z.string().nullable().describe("Full postal address as printed"),
  city: z.string().nullable().describe("City in English"),
  country: z.string().nullable().describe("ISO 3166-1 alpha-2 code, inferred from address or phone code if not printed"),
  language: z.string().describe("ISO 639-1 code of the main non-English script on the card, or 'en'"),
  roleFamily: z.enum(ROLE_FAMILIES),
  seniority: z.enum(SENIORITIES),
  industry: z.string().nullable().describe("Short industry label such as Software, Healthcare, Fintech, Robotics"),
  confidence: z.object({ fullName: confidence, title: confidence, company: confidence, contact: confidence }),
});

export type CardExtraction = z.infer<typeof cardExtractionSchema>;

/** The reviewed card, as the user edits and saves it. */
export const reviewedCardSchema = z.object({
  fullName: z.string().trim().min(1, "Name is required").max(200),
  nameNative: z.string().trim().max(200).optional().default(""),
  title: z.string().trim().max(200).optional().default(""),
  company: z.string().trim().max(200).optional().default(""),
  emails: z.array(z.string().trim().max(254)).max(10).default([]),
  phones: z.array(z.string().trim().max(40)).max(10).default([]),
  website: z.string().trim().max(253).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  city: z.string().trim().max(120).optional().default(""),
  country: z
    .string()
    .trim()
    .regex(/^([A-Z]{2})?$/, "Use a 2-letter country code")
    .optional()
    .default(""),
  roleFamily: z.enum(ROLE_FAMILIES),
  seniority: z.enum(SENIORITIES),
  industry: z.string().trim().max(80).optional().default(""),
});

export type ReviewedCard = z.infer<typeof reviewedCardSchema>;
