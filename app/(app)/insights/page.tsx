import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDaysIcon, LightbulbIcon, ScanLineIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ChartCard } from "@/components/insights/charts";
import { SummaryCard } from "@/components/insights/summary-card";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NetworkStats } from "@/lib/ai/insights";
import { getProfile, requireUser } from "@/lib/auth/dal";
import { topWithOther } from "@/lib/chart-rows";
import { formatDay } from "@/lib/dates";
import { countryName } from "@/lib/knowledge/text";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Insights" };

const month = (ym: string) => new Date(`${ym}-01T12:00:00Z`).toLocaleDateString("en", { month: "short", timeZone: "UTC" });

function Tile({ label, value, detail }: { label: string; value: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <Card className="gap-1 py-4">
      <CardHeader className="px-4">
        <CardDescription className="text-xs sm:text-sm">{label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 px-4">
        <p className="text-2xl font-semibold sm:text-3xl">{value}</p>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </CardContent>
    </Card>
  );
}

/** A ranked list with a bar behind each count, for named things where the name matters most. */
function Ranked({ title, description, rows }: { title: string; description: string; rows: { key: string; label: string; sub?: string; count: number; href: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <ol className="space-y-1">
            {rows.map((r) => (
              <li key={r.key}>
                <Link href={r.href} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.label}</span>
                    {r.sub && <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>}
                  </span>
                  <span className="flex w-28 shrink-0 items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${(r.count / max) * 100}%` }} />
                    </span>
                    <span className="w-6 text-right text-sm tabular-nums text-muted-foreground">{r.count}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

export default async function InsightsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const profile = await getProfile(user.id);
  const { data, error } = await supabase.rpc("network_insights", { p_time_zone: profile?.timezone ?? "UTC" });
  if (error) throw new Error("Couldn't load insights");
  const s = data as unknown as NetworkStats;

  if (s.totals.people === 0) {
    return (
      <PageContainer>
        <PageHeader title="Insights" description="Patterns across your network: industries, roles, follow-up habits." />
        <EmptyState icon={LightbulbIcon} title="Insights need a few contacts" description="Once you've added people, you'll see trends and gaps here.">
          <Button asChild>
            <Link href="/scan">
              <ScanLineIcon data-icon="inline-start" />
              Scan cards
            </Link>
          </Button>
        </EmptyState>
      </PageContainer>
    );
  }

  const inTouch = (s.lastTouch[0]?.count ?? 0) + (s.lastTouch[1]?.count ?? 0);
  const inTouchPct = Math.round((inTouch / s.totals.people) * 100);
  const delta = s.totals.addedThisMonth - s.totals.addedLastMonth;

  return (
    <PageContainer className="space-y-4">
      <PageHeader title="Insights" description="Patterns across your network: who you know, where you met, and how you're keeping in touch." />

      <SummaryCard />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="People"
          value={s.totals.people.toLocaleString("en")}
          detail={
            <>
              {s.totals.addedThisMonth} added this month
              {s.totals.addedLastMonth > 0 || s.totals.addedThisMonth > 0 ? ` (${delta >= 0 ? "+" : "−"}${Math.abs(delta)} vs last month)` : ""}
            </>
          }
        />
        <Tile label="Companies and events" value={`${s.totals.companies} · ${s.totals.events}`} detail={`${s.totals.notes} notes, ${s.totals.voiceNotes} by voice`} />
        <Tile
          label="In touch in the last 3 months"
          value={`${inTouchPct}%`}
          detail={
            <span className="flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#cde2fb] dark:bg-[#184f95]">
                <span className="block h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]" style={{ width: `${inTouchPct}%` }} />
              </span>
              {inTouch} of {s.totals.people}
            </span>
          }
        />
        <Tile
          label="Open follow-ups"
          value={s.followUps.open}
          detail={`${s.followUps.overdue} overdue · ${s.followUps.doneThisMonth} done this month`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="People added"
          description="New people each month, last 12 months."
          label="Month"
          layout="columns"
          rows={s.growth.map((g) => ({ label: month(g.month), count: g.people }))}
        />
        <ChartCard
          title="Time since you last got in touch"
          description="Meetings, calls and messages you've logged."
          label="Last in touch"
          layout="columns"
          rows={s.lastTouch.map((b) => ({ label: b.bucket, count: b.count }))}
        />
        <ChartCard title="Kinds of role" label="Role" layout="bars" rows={topWithOther(s.roles)} />
        <ChartCard title="Industries" label="Industry" layout="bars" rows={topWithOther(s.industries)} />
        {/* Horizontal so every level's name fits; kept in level order, not sorted by size. */}
        <ChartCard title="Seniority" label="Seniority" layout="bars" rows={s.seniority.map((x) => ({ label: x.value, count: x.count }))} />
        <ChartCard
          title="Where they're based"
          label="Country"
          layout="bars"
          rows={topWithOther(s.countries.map((c) => ({ value: countryName(c.value) ?? c.value, count: c.count })))}
        />
        <Ranked
          title="Companies you know best"
          description="Most people at one company."
          rows={s.companies.map((c) => ({ key: c.id, label: c.name, count: c.count, href: `/contacts?company=${c.id}` }))}
        />
        <Ranked
          title="Events that grew your network"
          description="Most people met at one event."
          rows={s.events.map((e) => ({
            key: e.id,
            label: e.name,
            sub: e.date ? formatDay(e.date) : undefined,
            count: e.count,
            href: `/events/${e.id}`,
          }))}
        />
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDaysIcon className="size-3.5" /> Months follow your time zone ({profile?.timezone ?? "UTC"}).
      </p>
    </PageContainer>
  );
}
