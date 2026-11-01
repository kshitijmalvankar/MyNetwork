import { ChevronRightIcon } from "lucide-react";
import { ContactLink } from "@/components/contacts/contact-link";
import { PersonAvatar, PersonNameMorph } from "@/components/contacts/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ContactRow } from "@/lib/contacts/queries";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

// Columns drop away as space runs out, so the list never scrolls sideways.
const COLUMNS =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_6.5rem] lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,1fr)_6.5rem]";

function place(r: ContactRow) {
  return [r.city, r.country].filter(Boolean).join(", ") || "—";
}

/** Everyone in one floating panel: just name and role on phones, more columns as the screen grows. */
export function ContactList({ rows }: { rows: ContactRow[] }) {
  return (
    <Card className="gap-0 px-2 py-2 md:px-3 md:py-3">
      <div aria-hidden className={cn(COLUMNS, "hidden px-3 pt-1 pb-2 text-xs font-medium text-muted-foreground md:grid")}>
        <span>Name</span>
        <span>Company</span>
        <span className="hidden lg:block">Role</span>
        <span className="hidden lg:block">Location</span>
        <span className="text-right">Last contacted</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.id}>
            <ContactLink
              id={r.id}
              className={cn(
                COLUMNS,
                "rounded-xl px-3 py-2 outline-none transition-[background-color,scale] duration-150 hover:bg-muted/70 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring/50",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <PersonAvatar name={r.fullName} morphId={r.id} />
                <span className="min-w-0">
                  <PersonNameMorph id={r.id}>
                    <span className="block w-fit max-w-full truncate font-medium">{r.fullName}</span>
                  </PersonNameMorph>
                  <span className="block truncate text-[13px] text-muted-foreground md:hidden">{[r.title, r.companyName].filter(Boolean).join(" · ") || "—"}</span>
                  <span className="hidden truncate text-[13px] text-muted-foreground md:block">{r.title ?? "—"}</span>
                </span>
              </span>
              <span className="hidden truncate text-sm md:block">{r.companyName ?? "—"}</span>
              <span className="hidden min-w-0 items-center gap-1.5 lg:flex">
                {r.roleFamily && <Badge variant="secondary">{r.roleFamily}</Badge>}
                {r.seniority && <span className="truncate text-xs text-muted-foreground">{r.seniority}</span>}
              </span>
              <span className="hidden truncate text-sm text-muted-foreground lg:block">{place(r)}</span>
              <span className="hidden text-right text-sm text-muted-foreground md:block">{r.lastContactedAt ? timeAgo(r.lastContactedAt) : "—"}</span>
              <ChevronRightIcon className="size-4 text-muted-foreground/60 md:hidden" />
            </ContactLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}
