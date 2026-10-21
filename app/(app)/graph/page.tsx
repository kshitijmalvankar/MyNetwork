import type { Metadata } from "next";
import { WaypointsIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Graph" };

export default function GraphPage() {
  return (
    <PageContainer>
      <PageHeader title="Graph" description="See how the people you've met connect." />
      <EmptyState
        icon={WaypointsIcon}
        title="Your network map appears here"
        description="People link up by company, event and similar roles as you add them."
      />
    </PageContainer>
  );
}
