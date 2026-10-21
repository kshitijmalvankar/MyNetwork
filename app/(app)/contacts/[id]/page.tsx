import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefcaseIcon, Building2Icon, ChevronLeftIcon, GlobeIcon, HistoryIcon, MailIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import { ContactMenu, LogInteractionDialog } from "@/components/contacts/contact-actions";
import { EditContactSheet } from "@/components/contacts/edit-contact-sheet";
import { RemindersCard } from "@/components/contacts/reminders-card";
import { Timeline } from "@/components/contacts/timeline";
import { PageContainer } from "@/components/shell/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getProfile, requireUser } from "@/lib/auth/dal";
import { getContactDetail } from "@/lib/contacts/queries";
import { formatDay, todayIn } from "@/lib/dates";
import { initials, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/contacts/[id]">): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("contacts").select("full_name").eq("id", id).maybeSingle();
  return { title: data?.full_name ?? "Contact" };
}

function regionName(code: string | null) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export default async function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const contact = await getContactDetail(user.id, id);
  if (!contact) notFound();

  const supabase = await createClient();
  const [profile, { data: events }] = await Promise.all([
    getProfile(user.id),
    supabase.from("events").select("id, name, starts_on").order("starts_on", { ascending: false, nullsFirst: false }).limit(100),
  ]);
  const today = todayIn(profile?.timezone);
  const location = [contact.city, regionName(contact.country)].filter(Boolean).join(", ");

  return (
    <PageContainer>
      <Link href="/contacts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Contacts
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Avatar className="size-16 text-lg">
            <AvatarFallback className="bg-brand-subtle text-brand">{initials(contact.fullName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{contact.fullName}</h1>
            {contact.nameNative && <p className="text-muted-foreground">{contact.nameNative}</p>}
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              {contact.title && <span className="text-foreground">{contact.title}</span>}
              {contact.title && contact.company && <span>at</span>}
              {contact.company && (
                <Link href={`/contacts?company=${contact.company.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                  {contact.company.name}
                </Link>
              )}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {contact.roleFamily && <Badge variant="secondary">{contact.roleFamily}</Badge>}
              {contact.seniority && <Badge variant="outline">{contact.seniority}</Badge>}
              {contact.industry && <Badge variant="outline">{contact.industry}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <LogInteractionDialog contactId={contact.id} events={(events ?? []).map((e) => ({ id: e.id, name: e.name, startsOn: e.starts_on }))} today={today} />
          <EditContactSheet contact={contact} />
          <ContactMenu contactId={contact.id} name={contact.fullName} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="order-2 space-y-4 lg:order-1">
          <Timeline contactId={contact.id} items={contact.timeline} />
        </div>

        <div className="order-1 space-y-4 lg:order-2">
          <Card className="gap-4 shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {contact.emails.map((e) => (
                <a key={e} href={`mailto:${e}`} className="flex items-center gap-3 hover:text-brand">
                  <MailIcon className="size-4 shrink-0 text-muted-foreground" /> <span className="truncate">{e}</span>
                </a>
              ))}
              {contact.phones.map((p) => (
                <a key={p} href={`tel:${p}`} className="flex items-center gap-3 hover:text-brand">
                  <PhoneIcon className="size-4 shrink-0 text-muted-foreground" /> {p}
                </a>
              ))}
              {contact.website && (
                <a href={`https://${contact.website}`} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-3 hover:text-brand">
                  <GlobeIcon className="size-4 shrink-0 text-muted-foreground" /> {contact.website}
                </a>
              )}
              {(contact.address || location) && (
                <p className="flex items-start gap-3">
                  <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{contact.address || location}</span>
                </p>
              )}
              {!contact.emails.length && !contact.phones.length && !contact.website && !contact.address && !location && (
                <p className="text-muted-foreground">No contact details.</p>
              )}
              <p className="flex items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
                <HistoryIcon className="size-3.5" />
                Added {timeAgo(contact.createdAt)}
                {contact.lastContactedAt && ` · last contact ${timeAgo(contact.lastContactedAt)}`}
              </p>
            </CardContent>
          </Card>

          <RemindersCard contactId={contact.id} reminders={contact.reminders} today={today} />

          {contact.images.length > 0 && (
            <Card className="gap-4 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Business card</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {contact.images.map((img) => (
                  <Dialog key={img.id}>
                    <DialogTrigger asChild>
                      <button type="button" className="overflow-hidden rounded-lg border bg-muted" aria-label={`View ${img.side} of card`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/contacts/${contact.id}/images/${img.id}?size=thumb`} alt="" className="aspect-[7/4] w-full object-cover" loading="lazy" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[min(96vw,1100px)] p-2 sm:p-3">
                      <DialogTitle className="sr-only">Business card ({img.side})</DialogTitle>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/contacts/${contact.id}/images/${img.id}`} alt={`${img.side} of card`} className="max-h-[85vh] w-full rounded-lg object-contain" />
                    </DialogContent>
                  </Dialog>
                ))}
              </CardContent>
            </Card>
          )}

          {contact.pastPositions.length > 0 && (
            <Card className="gap-4 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Previously</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {contact.pastPositions.map((p, i) => (
                    <li key={i} className="flex items-start gap-3">
                      {p.title ? <BriefcaseIcon className="mt-0.5 size-4 text-muted-foreground" /> : <Building2Icon className="mt-0.5 size-4 text-muted-foreground" />}
                      <div>
                        <p>{[p.title, p.company].filter(Boolean).join(" at ") || "Unknown role"}</p>
                        <p className="text-xs text-muted-foreground">until {formatDay(p.until)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
