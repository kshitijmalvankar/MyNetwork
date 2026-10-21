import type { Metadata } from "next";
import { ScanLineIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Scan cards" };

export default function ScanPage() {
  return (
    <PageContainer>
      <PageHeader title="Scan cards" description="Snap a card with your camera or drop in photos. Front and back, one or many." />
      <EmptyState
        icon={ScanLineIcon}
        title="Card capture is coming next"
        description="You'll be able to take a photo on your phone or drag in a stack of cards on desktop."
      />
    </PageContainer>
  );
}
