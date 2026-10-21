"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createEvent, updateEvent, type EventInput } from "@/app/(app)/events/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export function EventFormDialog({
  eventId,
  initial,
  trigger,
}: {
  eventId?: string;
  initial?: Required<Omit<EventInput, "startsOn">> & { startsOn: string };
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const blank = { name: "", startsOn: "", location: "", description: "" };
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial ?? blank);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const res = eventId ? await updateEvent(eventId, form) : await createEvent(form);
      if (!res.ok) return void toast.error(res.message);
      toast.success(eventId ? "Event saved" : "Event added");
      setOpen(false);
      if (!eventId && res.id) router.push(`/events/${res.id}`);
      else router.refresh();
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm(initial ?? blank);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{eventId ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>Conferences, meetups, dinners: anywhere you meet people.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="ev-name">Name</FieldLabel>
            <Input id="ev-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10" autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ev-date">Date</FieldLabel>
              <Input id="ev-date" type="date" value={form.startsOn} onChange={(e) => setForm({ ...form, startsOn: e.target.value })} className="h-10" />
            </Field>
            <Field>
              <FieldLabel htmlFor="ev-location">Location</FieldLabel>
              <Input id="ev-location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="h-10" />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="ev-desc">Notes</FieldLabel>
            <Textarea
              id="ev-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What was it about? Who organised it?"
            />
            <FieldDescription>Encrypted. You&apos;ll be able to ask about this later.</FieldDescription>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button onClick={save} disabled={pending || !form.name.trim()}>
            {pending && <Spinner />} {eventId ? "Save" : "Add event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
