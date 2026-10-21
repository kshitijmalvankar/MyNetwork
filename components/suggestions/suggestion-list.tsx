"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { BellPlusIcon, HourglassIcon, SparklesIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { acceptSuggestion, dismissSuggestion } from "@/app/(app)/contacts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDay } from "@/lib/dates";
import { timeAgo } from "@/lib/format";
import type { Suggestion } from "@/lib/suggestions";

const addDays = (isoDay: string, days: number) => {
  const d = new Date(`${isoDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

function Item({ s, today, showContact, onDone }: { s: Suggestion; today: string; showContact: boolean; onDone: (id: string) => void }) {
  const [due, setDue] = useState(s.dueOn && s.dueOn >= today ? s.dueOn : addDays(today, s.kind === "reconnect" ? 2 : 3));
  const [pending, startTransition] = useTransition();
  const firstName = s.name.split(/\s+/)[0];
  const text = s.kind === "reconnect" ? `Get back in touch with ${firstName}` : (s.text ?? "Follow up");

  const accept = () =>
    startTransition(async () => {
      onDone(s.id);
      const res = await acceptSuggestion(s.id, { dueOn: due, text });
      if (!res.ok) toast.error(res.message);
      else toast.success(`Reminder added for ${formatDay(due)}`);
    });
  const dismiss = () =>
    startTransition(async () => {
      onDone(s.id);
      const res = await dismissSuggestion(s.id);
      if (!res.ok) toast.error(res.message);
    });

  const Icon = s.kind === "reconnect" ? HourglassIcon : SparklesIcon;
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-medium">{text}</p>
          <p className="text-xs text-muted-foreground">
            {showContact && (
              <>
                <Link href={`/contacts/${s.contactId}`} className="font-medium text-foreground hover:underline">
                  {s.name}
                </Link>
                {s.subtitle && ` · ${s.subtitle}`}
                {" · "}
              </>
            )}
            {s.kind === "reconnect"
              ? `Last in touch ${s.lastContact ? timeAgo(s.lastContact) : "a while ago"}`
              : s.dueOn
                ? `From your note · mentioned for ${formatDay(s.dueOn)}`
                : "From your note"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={due}
            min={today}
            onChange={(e) => e.target.value && setDue(e.target.value)}
            className="h-7 w-auto px-2 text-xs"
            aria-label="Reminder date"
          />
          <Button size="sm" variant="outline" disabled={pending} onClick={accept}>
            <BellPlusIcon data-icon="inline-start" />
            Add reminder
          </Button>
          <Button size="icon-sm" variant="ghost" disabled={pending} onClick={dismiss} aria-label={`Dismiss: ${text}`} className="text-muted-foreground">
            <XIcon />
          </Button>
        </div>
      </div>
    </li>
  );
}

/** Suggestions to approve or dismiss. Accepting one adds a follow-up reminder; nothing happens on its own. */
export function SuggestionList({ items, today, showContact = true }: { items: Suggestion[]; today: string; showContact?: boolean }) {
  const [visible, hide] = useOptimistic(items, (list, id: string) => list.filter((s) => s.id !== id));
  if (visible.length === 0) return <p className="text-sm text-muted-foreground">All caught up.</p>;
  return (
    <ul className="divide-y">
      {visible.map((s) => (
        <Item key={s.id} s={s} today={today} showContact={showContact} onDone={hide} />
      ))}
    </ul>
  );
}
