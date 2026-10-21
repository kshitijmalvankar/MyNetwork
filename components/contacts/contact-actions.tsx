"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlusIcon, ContactIcon, EllipsisIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { deleteContact, logInteraction } from "@/app/(app)/contacts/actions";
import { EventPicker, type EventChoice, type EventOption } from "@/components/review/event-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type InteractionType = "met" | "email" | "call" | "meeting" | "message";

const TYPES: { value: InteractionType; label: string }[] = [
  { value: "met", label: "Met" },
  { value: "meeting", label: "Meeting" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "message", label: "Message" },
];

export function LogInteractionDialog({ contactId, events, today }: { contactId: string; events: EventOption[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<InteractionType>("meeting");
  const [date, setDate] = useState(today);
  const [event, setEvent] = useState<EventChoice>({});
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await logInteraction(contactId, { type, metOn: date, ...event, notes: notes.trim() || undefined });
      if (!res.ok) return void toast.error(res.message);
      toast.success("Logged");
      setOpen(false);
      setNotes("");
      setEvent({});
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <CalendarPlusIcon /> Log
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log an interaction</DialogTitle>
          <DialogDescription>Keeps their timeline and follow-up suggestions up to date.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <ToggleGroup type="single" value={type} onValueChange={(v) => v && setType(v as InteractionType)} variant="outline" className="w-full flex-wrap">
            {TYPES.map((t) => (
              <ToggleGroupItem key={t.value} value={t.value} className="flex-1">
                {t.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field>
              <FieldLabel htmlFor="log-event">Event (optional)</FieldLabel>
              <EventPicker events={events} value={event} onChange={setEvent} />
            </Field>
            <Field>
              <FieldLabel htmlFor="log-date">Date</FieldLabel>
              <Input id="log-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="h-10" />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="log-notes">Notes (optional)</FieldLabel>
            <Textarea id="log-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you discuss?" />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !date}>
            {pending && <Spinner />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContactMenu({ contactId, name }: { contactId: string; name: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, startTransition] = useTransition();

  const remove = () =>
    startTransition(async () => {
      const res = await deleteContact(contactId);
      if (!res.ok) return void toast.error(res.message);
      toast.success(`Deleted ${name}`);
      router.replace("/contacts");
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-lg" aria-label="More actions">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <a href={`/api/contacts/${contactId}/vcard`} download>
              <ContactIcon /> Save to phone contacts (.vcf)
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(true)}>
            <Trash2Icon /> Delete contact
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their details, notes, reminders and card photos will be permanently deleted. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={pending} className="bg-destructive text-white hover:bg-destructive/90">
              {pending && <Spinner />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
