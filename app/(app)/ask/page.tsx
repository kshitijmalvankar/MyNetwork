import type { Metadata } from "next";
import { MessageCircleIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Ask" };

export default function AskPage() {
  return (
    <PageContainer>
      <PageHeader title="Ask" description="Ask your network anything, like who you met from a company." />
      <EmptyState
        icon={MessageCircleIcon}
        title="Ask anything about your network"
        description="Try “Who did I meet from XYZ?” or “Which software engineers did I meet last month?” once you've added people."
      />
    </PageContainer>
  );
}
