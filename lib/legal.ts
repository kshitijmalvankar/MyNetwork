/**
 * Who runs this deployment, for the privacy policy and terms. Set in the
 * environment so personal details stay out of the repository. Until all three
 * are set, the legal pages say they're a draft.
 */
export function legalDetails() {
  const operator = process.env.LEGAL_OPERATOR_NAME?.trim() || null;
  const contactEmail = process.env.LEGAL_CONTACT_EMAIL?.trim() || null;
  const governingLaw = process.env.LEGAL_GOVERNING_LAW?.trim() || null;
  return {
    operator: operator ?? "[operator name]",
    contactEmail,
    governingLaw,
    complete: Boolean(operator && contactEmail && governingLaw),
  };
}

/** Change when either document changes in substance. */
export const LEGAL_UPDATED = "2026-10-22";
