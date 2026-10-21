import type { Metadata } from "next";
import { InboxIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Review" };

export default function ReviewPage() {
  return (
    <PageContainer>
      <PageHeader title="Review" description="Check what was read from each card before it's saved." />
      <EmptyState
        icon={InboxIcon}
        title="Nothing to review"
        description="Scanned cards wait here so you can fix anything before saving."
      />
    </PageContainer>
  );
}
