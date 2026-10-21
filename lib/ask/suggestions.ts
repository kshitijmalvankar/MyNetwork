import "server-only";
import type { Facets } from "@/lib/contacts/queries";

const ROLE_PLURALS: Record<string, string> = {
  Engineering: "software engineers",
  Product: "product managers",
  Design: "designers",
  Data: "data people",
  Sales: "salespeople",
  Marketing: "marketers",
  Finance: "finance people",
  Operations: "operations people",
  HR: "HR people",
  Legal: "lawyers",
  Executive: "executives",
  Founder: "founders",
  Consulting: "consultants",
  Research: "researchers",
  Healthcare: "healthcare people",
  Education: "educators",
};

/** Starter questions built from the user's own network. */
export function askSuggestions(facets: Facets): string[] {
  const out: string[] = [];
  const company = facets.companies[0]?.label;
  if (company) out.push(`Who did I meet from ${company}?`);
  const role = facets.roleFamilies.find((r) => ROLE_PLURALS[r.value]);
  if (role) out.push(`Which ${ROLE_PLURALS[role.value]} do I know?`);
  const event = facets.events[0]?.label;
  if (event) out.push(`Who did I meet at ${event}?`);
  out.push("Who should I follow up with this week?");
  return out;
}
