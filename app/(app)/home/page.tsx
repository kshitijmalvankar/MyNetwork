import Link from "next/link";
import type { Metadata } from "next";
import { BellIcon, Building2Icon, CalendarDaysIcon, ScanLineIcon, SparklesIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/shell/page-header";

export const metadata: Metadata = { title: "Home" };

const stats = [
  { label: "People", value: 0, icon: UsersIcon },
  { label: "Companies", value: 0, icon: Building2Icon },
  { label: "Events", value: 0, icon: CalendarDaysIcon },
];

export default function HomePage() {
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
