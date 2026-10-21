import Link from "next/link";
import type { Metadata } from "next";
import { BellIcon, Building2Icon, CalendarDaysIcon, ScanLineIcon, SparklesIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  await requireUser();
  const supabase = await createClient();
  const count = (table: "contacts" | "companies" | "events") =>
    supabase.from(table).select("*", { count: "exact", head: true }).then((r) => r.count ?? 0);
  const [people, companies, events, toReview] = await Promise.all([
    count("contacts"),
    count("companies"),
    count("events"),
    supabase.from("scans").select("*", { count: "exact", head: true }).eq("status", "needs_review").then((r) => r.count ?? 0),
  ]);
  const stats = [
    { label: "People", value: people, icon: UsersIcon, href: "/contacts" },
    { label: "Companies", value: companies, icon: Building2Icon, href: "/contacts" },
    { label: "Events", value: events, icon: CalendarDaysIcon, href: "/events" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Good to see you"
        description="Everyone you've met, in one place."
        actions={
          <Button asChild className="bg-brand text-brand-foreground hover:bg-brand/90">
            <Link href="/scan">
              <ScanLineIcon /> Scan a card
            </Link>
          </Button>
        }
      />

      {toReview > 0 && (
        <Link
          href="/review"
          className="flex items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-subtle px-4 py-3 text-sm transition-colors hover:bg-brand-subtle/70"
        >
          <span>
            <span className="font-medium">{toReview} {toReview === 1 ? "card is" : "cards are"} ready to review.</span>{" "}
            <span className="text-muted-foreground">Check them and save to your contacts.</span>
          </span>
          <span className="font-medium text-brand">Review →</span>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="gap-2 py-4 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between px-4">
              <CardDescription className="text-xs sm:text-sm">{s.label}</CardDescription>
              <s.icon className="hidden size-4 text-muted-foreground sm:block" />
            </CardHeader>
            <CardContent className="px-4">
              <p className="text-2xl font-semibold tabular-nums sm:text-3xl">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BellIcon className="size-4 text-brand" /> Follow-ups due
            </CardTitle>
            <CardDescription>Reminders you set or accepted.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={BellIcon}
              title="Nothing due"
              description="When you add a reminder to a contact, it shows up here."
              className="py-10"
            />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SparklesIcon className="size-4 text-brand" /> Suggestions
            </CardTitle>
            <CardDescription>Ideas from your notes. Nothing changes until you accept.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={SparklesIcon}
              title="No suggestions yet"
              description="Add notes or voice memos and you'll get reminder and reconnect ideas here."
              className="py-10"
            />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
