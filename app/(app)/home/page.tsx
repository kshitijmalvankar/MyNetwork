import Link from "next/link";
import type { Metadata } from "next";
import { BellIcon, Building2Icon, CalendarDaysIcon, ClockIcon, ScanLineIcon, SparklesIcon, UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FollowUpList, type FollowUp } from "@/components/home/follow-up-list";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { SuggestionList } from "@/components/suggestions/suggestion-list";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile, requireUser } from "@/lib/auth/dal";
import { openField } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { formatDay, todayIn } from "@/lib/dates";
import { initials, timeAgo } from "@/lib/format";
import { getSuggestions, refreshReconnects } from "@/lib/suggestions";
import { fromBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";
import { getUsage, nearLimit } from "@/lib/usage";

export const metadata: Metadata = { title: "Home" };

function greeting(timeZone: string | null | undefined, name: string | null | undefined) {
  let hour = 12;
  try {
    hour = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone: timeZone ?? "UTC" }).format(new Date()));
  } catch {}
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name.split(" ")[0]}` : part;
}

export default async function HomePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const profile = await getProfile(user.id);
  const today = todayIn(profile?.timezone);
  const horizon = new Date(`${today}T12:00:00Z`);
  horizon.setUTCDate(horizon.getUTCDate() + 7);

  // Cheap SQL, no AI: adds "get back in touch" suggestions for people it's been a while with.
  await refreshReconnects(user.id);

  const count = (table: "contacts" | "companies" | "events") =>
    supabase.from(table).select("*", { count: "exact", head: true }).then((r) => r.count ?? 0);
  const [people, companies, events, toReview, { data: reminders }, { data: recent }, suggestions, usage] = await Promise.all([
    count("contacts"),
    count("companies"),
    count("events"),
    supabase.from("scans").select("*", { count: "exact", head: true }).eq("status", "needs_review").then((r) => r.count ?? 0),
    supabase
      .from("reminders")
      .select("id, due_at, note_enc, contact_id, contacts(full_name, title, companies(name))")
      .is("done_at", null)
      .lte("due_at", horizon.toISOString())
      .order("due_at")
      .limit(20),
    supabase.from("contacts").select("id, full_name, title, created_at, companies(name)").order("created_at", { ascending: false }).limit(5),
    getSuggestions(supabase, user.id, { limit: 8 }),
    getUsage(supabase, user.id),
  ]);
  const runningLow = nearLimit(usage)[0];

  const dek = reminders?.some((r) => r.note_enc) ? await getUserDataKey(user.id) : null;
  const followUps: FollowUp[] = (reminders ?? []).map((r) => {
    const c = r.contacts as { full_name: string; title: string | null; companies: { name: string } | null } | null;
    return {
      id: r.id,
      contactId: r.contact_id,
      name: c?.full_name ?? "Contact",
      subtitle: [c?.title, c?.companies?.name].filter(Boolean).join(" · ") || null,
      due: r.due_at.slice(0, 10),
      note:
        dek && r.note_enc
          ? openField(dek, fromBytea(r.note_enc), { userId: user.id, table: "reminders", column: "note_enc", rowId: r.id }).toString("utf8")
          : null,
    };
  });

  const stats = [
    { label: "People", value: people, icon: UsersIcon, href: "/contacts" },
    { label: "Companies", value: companies, icon: Building2Icon, href: "/contacts?sort=company" },
    { label: "Events", value: events, icon: CalendarDaysIcon, href: "/events" },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={greeting(profile?.timezone, profile?.display_name)}
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
            <span className="font-medium">
              {toReview} {toReview === 1 ? "card is" : "cards are"} ready to review.
            </span>{" "}
            <span className="text-muted-foreground">Check them and save to your contacts.</span>
          </span>
          <span className="shrink-0 font-medium text-brand">Review →</span>
        </Link>
      )}

      {runningLow && (
        <Link
          href="/settings/usage"
          className="flex items-center justify-between gap-3 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15"
        >
          <span>
            <span className="font-medium">
              You&apos;ve used {runningLow.used} of {runningLow.quota} {runningLow.noun} this month.
            </span>{" "}
            <span className="text-muted-foreground">More on {formatDay(usage.resetsOn)}.</span>
          </span>
          <span className="shrink-0 font-medium">Usage →</span>
        </Link>
      )}

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-xl transition-transform active:scale-[0.98]">
            <Card className="gap-2 py-4 transition-colors hover:bg-muted/40">
              <CardHeader className="flex flex-row items-center justify-between px-4">
                <CardDescription className="text-xs sm:text-sm">{s.label}</CardDescription>
                <s.icon className="hidden size-4 text-muted-foreground sm:block" />
              </CardHeader>
              <CardContent className="px-4">
                <p className="text-2xl font-semibold tabular-nums sm:text-3xl">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SparklesIcon className="size-4 text-brand" /> Suggestions
            </CardTitle>
            <CardDescription>Follow-ups spotted in your notes, and people it&apos;s been a while since you contacted. Nothing happens unless you add it.</CardDescription>
          </CardHeader>
          <CardContent>
            <SuggestionList items={suggestions} today={today} />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BellIcon className="size-4 text-brand" /> Follow-ups
            </CardTitle>
            <CardDescription>Due in the next 7 days, plus anything overdue.</CardDescription>
          </CardHeader>
          <CardContent>
            {followUps.length ? (
              <FollowUpList items={followUps} today={today} />
            ) : (
              <EmptyState icon={BellIcon} title="Nothing due" description="Add a follow-up when you save a card or from someone's page." className="py-10" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClockIcon className="size-4 text-brand" /> Recently added
            </CardTitle>
            <CardDescription>The latest people in your network.</CardDescription>
          </CardHeader>
          <CardContent>
            {recent?.length ? (
              <ul className="divide-y">
                {recent.map((c) => (
                  <li key={c.id}>
                    <Link href={`/contacts/${c.id}`} className="flex items-center gap-3 py-3 first:pt-0">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-brand-subtle text-xs text-brand">{initials(c.full_name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[c.title, (c.companies as { name: string } | null)?.name].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={SparklesIcon} title="No one yet" description="Scan your first card to get started." className="py-10" />
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
