import Link from "next/link";
import type { Metadata } from "next";
import { CalendarDaysIcon, CalendarPlusIcon, MapPinIcon, UsersIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { EventFormDialog } from "@/components/events/event-form-dialog";
import { PageContainer, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Events" };

function DateBadge({ date }: { date: string | null }) {
  if (!date) {
    return (
      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <CalendarDaysIcon className="size-5" />
      </div>
    );
  }
  const d = new Date(`${date}T12:00:00Z`);
  return (
    <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-subtle text-brand">
      <span className="text-[11px] font-medium tracking-wide uppercase">{d.toLocaleDateString("en", { month: "short" })}</span>
      <span className="text-xl leading-none font-semibold">{d.getUTCDate()}</span>
    </div>
  );
}

export default async function EventsPage() {
  await requireUser();
  const supabase = await createClient();
  const { data: events } = await supabase.rpc("event_summaries");

  const add = (
    <EventFormDialog
      trigger={
        <Button>
          <CalendarPlusIcon /> New event
        </Button>
      }
    />
  );

  return (
    <PageContainer>
      <PageHeader title="Events" description="The conferences and meetups where you met people." actions={events?.length ? add : undefined} />
      {!events?.length ? (
        <EmptyState icon={CalendarDaysIcon} title="No events yet" description="Add an event here, or name one while reviewing a scanned card.">
          {add}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40">
                <DateBadge date={e.starts_on} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">{e.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    {e.starts_on && <span>{new Date(`${e.starts_on}T12:00:00Z`).getUTCFullYear()}</span>}
                    {e.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPinIcon className="size-3.5" /> {e.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <UsersIcon className="size-3.5" /> {e.people} {Number(e.people) === 1 ? "person" : "people"}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
