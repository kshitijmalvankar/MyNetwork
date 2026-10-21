import type { Metadata } from "next";
import { CalendarDaysIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <PageContainer>
      <PageHeader title="Events" description="The conferences and meetups where you met people." />
      <EmptyState
        icon={CalendarDaysIcon}
        title="No events yet"
        description="Add an event while reviewing a card to group the people you met there."
      />
    </PageContainer>
  );
}
