import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDaysIcon, ChevronLeftIcon, MapPinIcon, PencilIcon, UsersIcon } from "lucide-react";
import { ContactList } from "@/components/contacts/contact-list";
import { EmptyState } from "@/components/empty-state";
import { DeleteEventButton } from "@/components/events/delete-event-button";
import { EventFormDialog } from "@/components/events/event-form-dialog";
import { PageContainer } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { searchContacts } from "@/lib/contacts/queries";
import { openField } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { formatDay } from "@/lib/dates";
import { fromBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Event" };

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, name, starts_on, location, description_enc").eq("id", id).maybeSingle();
  if (!event) notFound();

  const description = event.description_enc
    ? openField(await getUserDataKey(user.id), fromBytea(event.description_enc), {
        userId: user.id,
        table: "events",
        column: "description_enc",
        rowId: event.id,
      }).toString("utf8")
    : "";
  const { rows, total } = await searchContacts({ event: event.id, sort: "name" }, { limit: 200 });

  return (
    <PageContainer>
      <Link href="/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Events
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{event.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {event.starts_on && (
              <span className="flex items-center gap-1.5">
                <CalendarDaysIcon className="size-4" /> {formatDay(event.starts_on)}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPinIcon className="size-4" /> {event.location}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <UsersIcon className="size-4" /> {total} {total === 1 ? "person" : "people"} met
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <EventFormDialog
            eventId={event.id}
            initial={{ name: event.name, startsOn: event.starts_on ?? "", location: event.location ?? "", description }}
            trigger={
              <Button variant="outline">
                <PencilIcon /> Edit
              </Button>
            }
          />
          <DeleteEventButton eventId={event.id} name={event.name} />
        </div>
      </div>

      {description && (
        <Card className="shadow-none">
          <CardContent className="text-sm whitespace-pre-wrap">{description}</CardContent>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No one linked yet" description="When you review a card or log a meeting, pick this event to link the person here." />
      ) : (
        <ContactList rows={rows} />
      )}
    </PageContainer>
  );
}
