"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  CheckIcon,
  FlipHorizontal2Icon,
  Link2Icon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { discardScan, rereadScan, saveReviewedScan } from "@/app/(app)/review/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_FAMILIES, SENIORITIES, type RoleFamily, type Seniority } from "@/lib/ai/card-schema";
import type { DuplicateCandidate } from "@/lib/contacts/duplicates";
import type { FieldIssue } from "@/lib/ai/validate";
import { cn } from "@/lib/utils";
import { EventPicker, type EventChoice, type EventOption } from "./event-picker";
import { ListEditor } from "./list-editor";

export type ReviewInitial = {
  fullName: string;
  nameNative: string;
  title: string;
  company: string;
  emails: string[];
  phones: string[];
  website: string;
  address: string;
  city: string;
  country: string;
  roleFamily: RoleFamily;
  seniority: Seniority;
  industry: string;
  isBusinessCard: boolean;
  qrUrl?: string;
};

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function Hint({ issues, field }: { issues: FieldIssue[]; field: string }) {
  const mine = issues.filter((i) => i.field === field);
  if (!mine.length) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs text-warning">
      <AlertTriangleIcon className="size-3.5 shrink-0" /> {mine.map((i) => i.message).join(" · ")}
    </p>
  );
}

function CardImage({ scanId, hasBack }: { scanId: string; hasBack: boolean }) {
  const [side, setSide] = useState<"front" | "back">("front");
  const src = `/api/scans/${scanId}/image?side=${side}`;
  return (
    <div className="space-y-3">
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" className="block w-full overflow-hidden rounded-xl border bg-muted" aria-label="Enlarge card photo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${side} of card`} className="max-h-[50vh] w-full object-contain" />
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-[min(96vw,1100px)] p-2 sm:p-3">
          <DialogTitle className="sr-only">Card photo</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${side} of card`} className="max-h-[85vh] w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
      {hasBack && (
        <Tabs value={side} onValueChange={(v) => setSide(v as "front" | "back")}>
          <TabsList className="w-full">
            <TabsTrigger value="front">Front</TabsTrigger>
            <TabsTrigger value="back">
              <FlipHorizontal2Icon /> Back
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
    </div>
  );
}

export function ReviewForm({
  scanId,
  hasBack,
  initial,
  issues,
  escalated,
  duplicates,
  events,
  today,
}: {
  scanId: string;
  hasBack: boolean;
  initial: ReviewInitial;
  issues: FieldIssue[];
  escalated: boolean;
  duplicates: DuplicateCandidate[];
  events: EventOption[];
  today: string;
}) {
  const router = useRouter();
  const [card, setCard] = useState(initial);
  const [event, setEvent] = useState<EventChoice>({});
  const [metOn, setMetOn] = useState(today);
  const [notes, setNotes] = useState("");
  const [reminder, setReminder] = useState<"none" | "7" | "14" | "30" | "custom">("none");
  const [reminderOn, setReminderOn] = useState(addDays(today, 7));
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"save" | "discard" | "reread" | null>(null);
  const [mergeInto, setMergeInto] = useState<DuplicateCandidate | null>(null);

  const set = <K extends keyof ReviewInitial>(key: K, value: ReviewInitial[K]) => setCard((c) => ({ ...c, [key]: value }));

  const goNext = (nextScanId: string | null) => router.push(nextScanId ? `/review/${nextScanId}` : "/review");

  const save = () => {
    if (!card.fullName.trim()) {
      toast.error("Add a name before saving.");
      return;
    }
    setBusy("save");
    startTransition(async () => {
      const res = await saveReviewedScan(scanId, {
        card: {
          fullName: card.fullName,
          title: card.title,
          company: card.company,
          emails: card.emails.filter((e) => e.trim()),
          phones: card.phones.filter((p) => p.trim()),
          website: card.website,
          address: card.address,
          city: card.city,
          country: card.country.toUpperCase(),
          roleFamily: card.roleFamily,
          seniority: card.seniority,
          industry: card.industry,
        },
        nameNative: card.nameNative,
        mergeInto: mergeInto?.id,
        meeting: {
          ...event,
          metOn,
          notes: notes.trim() || undefined,
          reminderOn: reminder === "none" ? undefined : reminder === "custom" ? reminderOn : addDays(today, Number(reminder)),
        },
      });
      setBusy(null);
      if (!res.ok) return void toast.error(res.message);
      toast.success(mergeInto ? `Updated ${mergeInto.fullName}` : `Saved ${card.fullName}`);
      goNext(res.nextScanId);
    });
  };

  const discard = () => {
    setBusy("discard");
    startTransition(async () => {
      const res = await discardScan(scanId);
      setBusy(null);
      if (!res.ok) return void toast.error(res.message);
      toast.success("Card removed");
      goNext(res.nextScanId);
    });
  };

  const reread = () => {
    setBusy("reread");
    startTransition(async () => {
      const res = await rereadScan(scanId);
      setBusy(null);
      if (!res.ok) return void toast.error(res.message);
      toast.success("Re-reading with a stronger model…");
      router.push("/review");
    });
  };

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <div className="space-y-4 lg:sticky lg:top-20">
        <CardImage scanId={scanId} hasBack={hasBack} />
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="gap-1">
            <SparklesIcon className="size-3" /> Read by AI{escalated ? " (double-checked)" : ""}
          </Badge>
          {card.qrUrl && (
            <a href={card.qrUrl} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1 underline-offset-4 hover:underline">
              <Link2Icon className="size-3" /> Link from QR code
            </a>
          )}
        </div>
        {!initial.isBusinessCard && (
          <Alert>
            <AlertTriangleIcon />
            <AlertTitle>This may not be a business card</AlertTitle>
            <AlertDescription>Fill in the details yourself, or remove it.</AlertDescription>
          </Alert>
        )}
        {duplicates.length > 0 && (
          <Alert className="border-warning/40 bg-warning/10">
            <UsersIcon className="text-warning" />
            <AlertTitle>You may already have this person</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-2">
                {duplicates.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>
                      <a href={`/contacts/${d.id}`} target="_blank" rel="noreferrer" className="font-medium text-foreground underline-offset-4 hover:underline">
                        {d.fullName}
                      </a>
                      {d.company && ` · ${d.company}`}
                      <span className="text-muted-foreground"> (same {d.reason})</span>
                    </span>
                    <Button
                      type="button"
                      size="xs"
                      variant={mergeInto?.id === d.id ? "default" : "outline"}
                      onClick={() => setMergeInto(mergeInto?.id === d.id ? null : d)}
                    >
                      {mergeInto?.id === d.id ? <CheckIcon /> : null}
                      {mergeInto?.id === d.id ? "Will update" : "Update instead"}
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                {mergeInto
                  ? `Saving adds this card to ${mergeInto.fullName}: new details are combined and a new job moves the old one to their history.`
                  : "Saving will add a separate contact."}
              </p>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Person</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="fullName">Name</FieldLabel>
                <Input id="fullName" value={card.fullName} onChange={(e) => set("fullName", e.target.value)} className="h-10 text-base font-medium" />
                <Hint issues={issues} field="fullName" />
              </Field>
              {(card.nameNative || initial.nameNative) && (
                <Field>
                  <FieldLabel htmlFor="nameNative">Name as written</FieldLabel>
                  <Input id="nameNative" value={card.nameNative} onChange={(e) => set("nameNative", e.target.value)} className="h-10" />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="title">Job title</FieldLabel>
                <Input id="title" value={card.title} onChange={(e) => set("title", e.target.value)} className="h-10" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="roleFamily">Role</FieldLabel>
                  <Select value={card.roleFamily} onValueChange={(v) => set("roleFamily", v as RoleFamily)}>
                    <SelectTrigger id="roleFamily" className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_FAMILIES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="seniority">Seniority</FieldLabel>
                  <Select value={card.seniority} onValueChange={(v) => set("seniority", v as Seniority)}>
                    <SelectTrigger id="seniority" className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SENIORITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="company">Company</FieldLabel>
                <Input id="company" value={card.company} onChange={(e) => set("company", e.target.value)} className="h-10" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="industry">Industry</FieldLabel>
                  <Input id="industry" value={card.industry} onChange={(e) => set("industry", e.target.value)} className="h-10" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="website">Website</FieldLabel>
                  <Input id="website" value={card.website} onChange={(e) => set("website", e.target.value)} className="h-10" inputMode="url" />
                  <Hint issues={issues} field="website" />
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact details</CardTitle>
            <CardDescription>Encrypted before they&apos;re stored.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <ListEditor id="email" type="email" values={card.emails} onChange={(v) => set("emails", v)} addLabel="Add email" placeholder="name@company.com" />
                <Hint issues={issues} field="emails" />
              </Field>
              <Field>
                <FieldLabel htmlFor="phone">Phone</FieldLabel>
                <ListEditor id="phone" type="tel" values={card.phones} onChange={(v) => set("phones", v)} addLabel="Add phone" placeholder="+1 555 0100" />
                <Hint issues={issues} field="phones" />
              </Field>
              <Field>
                <FieldLabel htmlFor="address">Address</FieldLabel>
                <Input id="address" value={card.address} onChange={(e) => set("address", e.target.value)} className="h-10" />
              </Field>
              <div className="grid grid-cols-[1fr_7rem] gap-4">
                <Field>
                  <FieldLabel htmlFor="city">City</FieldLabel>
                  <Input id="city" value={card.city} onChange={(e) => set("city", e.target.value)} className="h-10" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="country">Country</FieldLabel>
                  <Input
                    id="country"
                    value={card.country}
                    maxLength={2}
                    placeholder="US"
                    onChange={(e) => set("country", e.target.value.toUpperCase())}
                    className="h-10 uppercase"
                  />
                  <Hint issues={issues} field="country" />
                </Field>
              </div>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where you met</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
                <Field>
                  <FieldLabel htmlFor="event">Event</FieldLabel>
                  <EventPicker events={events} value={event} onChange={setEvent} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="metOn">Date</FieldLabel>
                  <Input id="metOn" type="date" value={metOn} max={today} onChange={(e) => setMetOn(e.target.value)} className="h-10" />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="notes">Notes</FieldLabel>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What did you talk about? Anything to remember?"
                  className="min-h-24"
                />
                <FieldDescription>Private and encrypted. You&apos;ll be able to ask about these later.</FieldDescription>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="reminder">Follow-up reminder</FieldLabel>
                  <Select value={reminder} onValueChange={(v) => setReminder(v as typeof reminder)}>
                    <SelectTrigger id="reminder" className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No reminder</SelectItem>
                      <SelectItem value="7">In 1 week</SelectItem>
                      <SelectItem value="14">In 2 weeks</SelectItem>
                      <SelectItem value="30">In 1 month</SelectItem>
                      <SelectItem value="custom">Pick a date…</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {reminder === "custom" && (
                  <Field>
                    <FieldLabel htmlFor="reminderOn">Remind me on</FieldLabel>
                    <Input id="reminderOn" type="date" min={today} value={reminderOn} onChange={(e) => setReminderOn(e.target.value)} className="h-10" />
                  </Field>
                )}
              </div>
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/90 px-4 py-3 backdrop-blur-xl md:bottom-0 md:left-[5.5rem]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
          <div className="flex gap-1">
            <Button variant="ghost" onClick={discard} disabled={pending}>
              {busy === "discard" ? <Spinner /> : <Trash2Icon />} <span className="hidden sm:inline">Remove</span>
            </Button>
            <Button variant="ghost" onClick={reread} disabled={pending}>
              {busy === "reread" ? <Spinner /> : <RotateCcwIcon />} <span className="hidden sm:inline">Re-read</span>
            </Button>
          </div>
          <Button onClick={save} disabled={pending} size="lg" className={cn("h-10 bg-brand px-5 text-brand-foreground hover:bg-brand/90")}>
            {busy === "save" ? <Spinner /> : <CheckIcon />} {mergeInto ? `Update ${mergeInto.fullName.split(" ")[0]}` : "Save contact"}
          </Button>
        </div>
      </div>
    </div>
  );
}
