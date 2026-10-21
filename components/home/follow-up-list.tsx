"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { setReminderDone } from "@/app/(app)/contacts/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { initials } from "@/lib/format";

export type FollowUp = { id: string; contactId: string; name: string; subtitle: string | null; due: string; note: string | null };

export function FollowUpList({ items, today }: { items: FollowUp[]; today: string }) {
  const [, startTransition] = useTransition();
  const [visible, hide] = useOptimistic(items, (list, id: string) => list.filter((i) => i.id !== id));

  const complete = (item: FollowUp) =>
    startTransition(async () => {
      hide(item.id);
      const res = await setReminderDone(item.contactId, item.id, true);
      if (!res.ok) toast.error(res.message);
      else toast.success(`Done: ${item.name}`);
    });

  return (
    <ul className="divide-y">
      {visible.map((item) => {
        const overdue = item.due < today;
        return (
          <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <Checkbox aria-label={`Mark follow-up with ${item.name} done`} onCheckedChange={() => complete(item)} />
            <Link href={`/contacts/${item.contactId}`} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar className="size-8">
                <AvatarFallback className="bg-brand-subtle text-xs text-brand">{initials(item.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="truncate text-xs text-muted-foreground">{item.note ?? item.subtitle ?? "Follow up"}</p>
              </div>
            </Link>
            <Badge variant={overdue ? "destructive" : item.due === today ? "default" : "secondary"} className="shrink-0">
              {overdue ? "Overdue" : item.due === today ? "Today" : new Date(`${item.due}T12:00:00Z`).toLocaleDateString("en", { day: "numeric", month: "short" })}
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
