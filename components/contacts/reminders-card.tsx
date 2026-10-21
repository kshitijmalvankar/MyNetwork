"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { createReminder, deleteReminder, setReminderDone } from "@/app/(app)/contacts/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ContactDetail } from "@/lib/contacts/queries";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function RemindersCard({ contactId, reminders, today }: { contactId: string; reminders: ContactDetail["reminders"]; today: string }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [due, setDue] = useState(today);
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.message);
      after?.();
      router.refresh();
    });

  const open = reminders.filter((r) => !r.doneAt);
  const done = reminders.filter((r) => r.doneAt).slice(-3);

  return (
    <Card className="gap-4 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <BellIcon className="size-4 text-brand" /> Follow-ups
        </CardTitle>
        {!adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <PlusIcon /> Add
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="space-y-2 rounded-lg border p-3">
            <Input type="date" value={due} min={today} onChange={(e) => setDue(e.target.value)} className="h-9" aria-label="Due date" />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What to follow up about (optional)" className="h-9" />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={pending || !due}
                onClick={() => run(() => createReminder(contactId, due, note), () => {
                  setAdding(false);
                  setNote("");
                })}
              >
                {pending && <Spinner />} Save
              </Button>
            </div>
          </div>
        )}
        {open.length === 0 && !adding && <p className="text-sm text-muted-foreground">No follow-ups planned.</p>}
        <ul className="space-y-2">
          {[...open, ...done].map((r) => {
            const day = r.dueAt.slice(0, 10);
            const overdue = !r.doneAt && day < today;
            const dueToday = !r.doneAt && day === today;
            return (
              <li key={r.id} className="group flex items-start gap-3">
                <Checkbox
                  checked={Boolean(r.doneAt)}
                  onCheckedChange={(v) => run(() => setReminderDone(contactId, r.id, Boolean(v)))}
                  aria-label="Mark done"
                  className="mt-0.5"
                />
                <div className={cn("min-w-0 flex-1 text-sm", r.doneAt && "text-muted-foreground line-through")}>
                  <div className="flex items-center gap-2">
                    <span>{formatDay(day)}</span>
                    {overdue && <Badge variant="destructive">Overdue</Badge>}
                    {dueToday && <Badge className="bg-brand text-brand-foreground">Today</Badge>}
                    {r.source === "ai" && <Badge variant="secondary">AI</Badge>}
                  </div>
                  {r.note && <p className="text-muted-foreground">{r.note}</p>}
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Delete follow-up"
                  className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={() => run(() => deleteReminder(contactId, r.id))}
                >
                  <Trash2Icon />
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
