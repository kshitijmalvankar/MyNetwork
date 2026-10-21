import Link from "next/link";
import type { Metadata } from "next";
import { after } from "next/server";
import { ScanLineIcon } from "lucide-react";
import { ReviewQueue } from "@/components/review/review-queue";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { sweepScans } from "@/lib/scans/process";
import { getReviewQueue } from "@/lib/scans/queries";

export const metadata: Metadata = { title: "Review" };

export default async function ReviewPage() {
  const user = await requireUser();
  const items = await getReviewQueue(user.id);

  // Pick up anything left behind (closed tab, restarted server).
  if (items.some((i) => i.status === "uploaded" || i.status === "processing")) {
    after(() => sweepScans({ userId: user.id }));
  }

  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        title="Review"
        description="Check what was read from each card, then save it to your contacts."
        actions={
          <Button asChild variant="outline">
            <Link href="/scan">
              <ScanLineIcon /> Scan more
            </Link>
          </Button>
        }
      />
      <ReviewQueue items={items} userId={user.id} />
    </PageContainer>
  );
}
