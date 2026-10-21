import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeftIcon, ChevronRightIcon, ScanLineIcon, SearchXIcon, UsersIcon } from "lucide-react";
import { ContactList } from "@/components/contacts/contact-list";
import { ContactsToolbar } from "@/components/contacts/contacts-toolbar";
import { ExportButton } from "@/components/contacts/export-button";
import { EmptyState } from "@/components/empty-state";
import { StepUpBoundary } from "@/components/security/step-up-boundary";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { getFacets, parseContactFilters, searchContacts } from "@/lib/contacts/queries";

export const metadata: Metadata = { title: "Contacts" };

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  await requireUser();
  const params = await searchParams;
  const filters = parseContactFilters(params);
  const [{ rows, total, page, pageSize }, facets] = await Promise.all([searchContacts(filters), getFacets()]);
  const filtered = Boolean(filters.q || filters.company || filters.role || filters.seniority || filters.industry || filters.country || filters.event);
  const empty = total === 0 && !filtered;

  const pageHref = (p: number) => {
    const next = new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    if (p > 1) next.set("page", String(p));
    else next.delete("page");
    return `/contacts${next.size ? `?${next}` : ""}`;
  };
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PageContainer>
      <PageHeader
        title="Contacts"
        description={empty ? "Everyone you've met." : `${total} ${total === 1 ? "person" : "people"}${filtered ? " match" : " in your network"}`}
        actions={
          <>
            {!empty && (
              <StepUpBoundary>
                <ExportButton />
              </StepUpBoundary>
            )}
            <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90">
              <Link href="/scan">
                <ScanLineIcon /> <span className="hidden sm:inline">Scan a card</span>
              </Link>
            </Button>
          </>
        }
      />

      {empty ? (
        <EmptyState icon={UsersIcon} title="No contacts yet" description="Scan your first business card and the person will appear here.">
          <Button asChild>
            <Link href="/scan">
              <ScanLineIcon /> Scan a card
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <ContactsToolbar facets={facets} />
          {rows.length === 0 ? (
            <EmptyState icon={SearchXIcon} title="No one matches" description="Try a different search or remove a filter." />
          ) : (
            <ContactList rows={rows} />
          )}
          {pages > 1 && (
            <nav className="flex items-center justify-between text-sm text-muted-foreground" aria-label="Pagination">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm" aria-disabled={page <= 1} className={page <= 1 ? "pointer-events-none opacity-50" : ""}>
                  <Link href={pageHref(page - 1)}>
                    <ChevronLeftIcon /> Previous
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm" aria-disabled={page >= pages} className={page >= pages ? "pointer-events-none opacity-50" : ""}>
                  <Link href={pageHref(page + 1)}>
                    Next <ChevronRightIcon />
                  </Link>
                </Button>
              </div>
            </nav>
          )}
        </>
      )}
    </PageContainer>
  );
}
