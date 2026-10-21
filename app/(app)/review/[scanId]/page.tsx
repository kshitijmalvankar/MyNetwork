import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { ReviewForm, type ReviewInitial } from "@/components/review/review-form";
import { PageContainer } from "@/components/shell/page-header";
import { normalizeCompanyName } from "@/lib/ai/validate";
import { getProfile, requireUser } from "@/lib/auth/dal";
import { findDuplicates } from "@/lib/contacts/duplicates";
import { getScanForReview } from "@/lib/scans/queries";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Review card" };

export default async function ReviewCardPage({ params }: PageProps<"/review/[scanId]">) {
  const { scanId } = await params;
  const user = await requireUser();
  const scan = await getScanForReview(user.id, scanId).catch(() => null);
  if (!scan) notFound();

  const { card, validation, qrUrl } = scan.stored;
  const supabase = await createClient();
  const [profile, { data: events }, duplicates] = await Promise.all([
    getProfile(user.id),
    supabase.from("events").select("id, name, starts_on").order("starts_on", { ascending: false, nullsFirst: false }).limit(100),
    findDuplicates(user.id, {
      emails: card.emails,
      phones: card.phoneNumbers,
      fullName: card.fullName,
      companyNormalized: card.company ? normalizeCompanyName(card.company) : undefined,
    }),
  ]);

  const initial: ReviewInitial = {
    fullName: card.fullName,
    nameNative: card.nameNative ?? "",
    title: card.title ?? "",
    company: card.company ?? "",
    emails: card.emails,
    phones: card.phoneNumbers,
    website: card.website ?? "",
    address: card.address ?? "",
    city: card.city ?? "",
    country: card.country ?? "",
    roleFamily: card.roleFamily,
    seniority: card.seniority,
    industry: card.industry ?? "",
    isBusinessCard: card.isBusinessCard,
    qrUrl,
  };

  return (
    <PageContainer className="space-y-4">
      <Link href="/review" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Review queue
      </Link>
      <ReviewForm
        key={scan.id}
        scanId={scan.id}
        hasBack={scan.hasBack}
        initial={initial}
        issues={validation.issues}
        escalated={scan.escalated}
        duplicates={duplicates}
        events={(events ?? []).map((e) => ({ id: e.id, name: e.name, startsOn: e.starts_on }))}
        today={todayIn(profile?.timezone)}
      />
    </PageContainer>
  );
}
