import { FileWarningIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDay } from "@/lib/dates";
import { legalDetails, LEGAL_UPDATED } from "@/lib/legal";

/** Long-form text with readable spacing, without pulling in a typography plugin. */
export function LegalDocument({ title, children }: { title: string; children: React.ReactNode }) {
  const { complete } = legalDetails();
  return (
    <article className="text-[0.9375rem] leading-relaxed text-foreground/90 [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:scroll-mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:font-medium [&_h3]:text-foreground [&_li]:mt-1.5 [&_p]:mt-3 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="!mt-2 text-sm text-muted-foreground">Last updated {formatDay(LEGAL_UPDATED)}</p>
      {!complete && (
        <Alert className="mt-6">
          <FileWarningIcon />
          <AlertTitle>Draft</AlertTitle>
          <AlertDescription>This document hasn&apos;t been finalized yet. Some details are still to be filled in.</AlertDescription>
        </Alert>
      )}
      {children}
    </article>
  );
}

/** The contact address, or a visible placeholder until it's configured. */
export function ContactEmail() {
  const { contactEmail } = legalDetails();
  return contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : <span>[contact email]</span>;
}
