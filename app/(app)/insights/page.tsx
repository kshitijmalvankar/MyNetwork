import type { Metadata } from "next";
import { LightbulbIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return (
    <PageContainer>
      <PageHeader title="Insights" description="Patterns across your network: industries, roles, follow-up habits." />
      <EmptyState
        icon={LightbulbIcon}
        title="Insights need a few contacts"
        description="Once you've added people, you'll see trends and gaps here."
      />
    </PageContainer>
  );
}
