import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BriefcaseIcon, Building2Icon, ChevronLeftIcon, GlobeIcon, HistoryIcon, MailIcon, MapPinIcon, PhoneIcon, SparklesIcon, type LucideIcon } from "lucide-react";
import { AssistCard } from "@/components/contacts/assist";
import { ContactMenu, LogInteractionDialog } from "@/components/contacts/contact-actions";
import { EditContactSheet } from "@/components/contacts/edit-contact-sheet";
import { PersonAvatar, PersonNameMorph } from "@/components/contacts/person-avatar";
import { RemindersCard } from "@/components/contacts/reminders-card";
import { Timeline } from "@/components/contacts/timeline";
import { PageContainer } from "@/components/shell/page-header";
import { SuggestionList } from "@/components/suggestions/suggestion-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { loadPersonContext } from "@/lib/ai/brief";
import { quotaStatus } from "@/lib/ai/metering";
import { getProfile, requireUser } from "@/lib/auth/dal";
import { formatDay, todayIn } from "@/lib/dates";
import { getSuggestions } from "@/lib/suggestions";
import { personHue, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const DETAIL = "flex h-9 max-w-full items-center gap-2 rounded-full bg-muted/70 px-3.5 text-sm [a&]:transition-colors [a&]:hover:bg-accent";

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
  const supabase = await createClient();
  const person = await loadPersonContext(supabase, user.id, id);
  if (!person) notFound();
  const { contact, related } = person;

  const [profile, { data: events }, quota, suggestions] = await Promise.all([
    getProfile(user.id),
    supabase.from("events").select("id, name, starts_on").order("starts_on", { ascending: false, nullsFirst: false }).limit(100),
    quotaStatus(user.id, "brief"),
    getSuggestions(supabase, user.id, { contactId: id }),
  ]);
  const knownIds = [
    contact.id,
    ...related.map((r) => r.id),
    ...contact.timeline.flatMap((t) => (t.kind === "interaction" && t.event ? [t.event.id] : [])),
  ];
  const today = todayIn(profile?.timezone);
  const location = contact.address || [contact.city, regionName(contact.country)].filter(Boolean).join(", ");
  const details: { label: string; icon: LucideIcon; href?: string; link?: React.ComponentProps<"a"> }[] = [
    ...contact.emails.map((e) => ({ label: e, icon: MailIcon, href: `mailto:${e}` })),
    ...contact.phones.map((p) => ({ label: p, icon: PhoneIcon, href: `tel:${p}` })),
    ...(contact.website
      ? [{ label: contact.website, icon: GlobeIcon, href: `https://${contact.website}`, link: { target: "_blank", rel: "noopener noreferrer nofollow" } }]
      : []),
    ...(location ? [{ label: location, icon: MapPinIcon }] : []),
  ];

  return (
    <PageContainer>
      <Link href="/contacts" transitionTypes={["nav-back"]} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> Contacts
      </Link>

      <Card className="relative py-0">
        <div aria-hidden className="person-wash absolute inset-x-0 top-0 h-36" style={{ "--hue": personHue(contact.fullName) } as React.CSSProperties} />
        <CardContent className="relative space-y-5 py-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <PersonAvatar name={contact.fullName} morphId={contact.id} className="size-20 text-2xl" />
            <div className="min-w-0 flex-1 space-y-1">
              <PersonNameMorph id={contact.id}>
                <h1 className="mx-auto w-fit max-w-full text-2xl font-semibold tracking-tight sm:mx-0 sm:text-3xl">{contact.fullName}</h1>
              </PersonNameMorph>
              {contact.nameNative && <p className="text-muted-foreground">{contact.nameNative}</p>}
              <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-muted-foreground sm:justify-start">
                {contact.title && <span className="text-foreground">{contact.title}</span>}
                {contact.title && contact.company && <span>at</span>}
                {contact.company && (
                  <Link href={`/contacts?company=${contact.company.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">
                    {contact.company.name}
                  </Link>
                )}
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 pt-1 sm:justify-start">
                {contact.roleFamily && <Badge variant="secondary">{contact.roleFamily}</Badge>}
                {contact.seniority && <Badge variant="secondary">{contact.seniority}</Badge>}
                {contact.industry && <Badge variant="secondary">{contact.industry}</Badge>}
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <LogInteractionDialog contactId={contact.id} events={(events ?? []).map((e) => ({ id: e.id, name: e.name, startsOn: e.starts_on }))} today={today} />
              <EditContactSheet contact={contact} />
              <ContactMenu contactId={contact.id} name={contact.fullName} />
            </div>
          </div>

          {details.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {details.map((d) => (
                <li key={d.label} className="max-w-full">
                  {d.href ? (
                    <a {...d.link} href={d.href} className={DETAIL}>
                      <d.icon className="size-4 shrink-0 text-muted-foreground" /> <span className="truncate">{d.label}</span>
                    </a>
                  ) : (
                    <span className={DETAIL}>
                      <d.icon className="size-4 shrink-0 text-muted-foreground" /> <span className="truncate">{d.label}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground sm:justify-start">
            <HistoryIcon className="size-3.5" />
            Added {timeAgo(contact.createdAt)}
            {contact.lastContactedAt && ` · last contact ${timeAgo(contact.lastContactedAt)}`}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="order-2 space-y-4 lg:order-1">
          <Timeline contactId={contact.id} items={contact.timeline} timeZone={profile?.timezone} />
        </div>

        <div className="order-1 space-y-4 lg:order-2">
          <AssistCard
            contactId={contact.id}
            firstName={contact.fullName.split(/\s+/)[0]}
            emails={contact.emails}
            knownIds={knownIds}
            quota={quota}
            today={today}
          />

          {suggestions.length > 0 && (
            <Card className="gap-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <SparklesIcon className="size-4 text-brand" /> Suggested follow-ups
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SuggestionList items={suggestions} today={today} showContact={false} />
              </CardContent>
            </Card>
          )}

          <RemindersCard contactId={contact.id} reminders={contact.reminders} today={today} />

          {contact.images.length > 0 && (
            <Card className="gap-4">
              <CardHeader>
                <CardTitle className="text-base">Business card</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                {contact.images.map((img) => (
                  <Dialog key={img.id}>
                    <DialogTrigger asChild>
                      <button type="button" className="overflow-hidden rounded-xl bg-muted shadow-sm" aria-label={`View ${img.side} of card`}>
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
            <Card className="gap-4">
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
