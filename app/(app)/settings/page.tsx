import type { Metadata } from "next";
import { SettingsIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Settings" description="Profile, security, usage and your data." />
      <EmptyState
        icon={SettingsIcon}
        title="Settings are on the way"
        description="Profile, two-factor login, exports and account deletion will live here."
      />
    </PageContainer>
  );
}
