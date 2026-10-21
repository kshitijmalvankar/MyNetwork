import type { Metadata } from "next";
import { CardCapture } from "@/components/scan/card-capture";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { quotaStatus } from "@/lib/ai/metering";
import { requireUser } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Scan cards" };

export default async function ScanPage() {
  const user = await requireUser();
  const { used, quota } = await quotaStatus(user.id, "scan");

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader title="Scan cards" description="Snap a card with your camera, or upload a stack of photos." />
      <CardCapture remaining={Math.max(0, quota - used)} />
    </PageContainer>
  );
}
