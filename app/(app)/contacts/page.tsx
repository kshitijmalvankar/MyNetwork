import type { Metadata } from "next";
import { UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage() {
  return (
    <PageContainer>
      <PageHeader title="Contacts" description="Everyone you've met, searchable and filterable." />
      <EmptyState
        icon={UsersIcon}
        title="No contacts yet"
        description="Scan your first business card and the person will appear here."
      />
    </PageContainer>
  );
}
