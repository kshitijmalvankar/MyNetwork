import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ContactRow } from "@/lib/contacts/queries";
import { initials, timeAgo } from "@/lib/format";

function place(r: ContactRow) {
  return [r.city, r.country].filter(Boolean).join(", ") || "—";
}

/** Table on wide screens, cards on phones. */
export function ContactList({ rows }: { rows: ContactRow[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="pr-4 text-right">Last contacted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="group relative">
                <TableCell className="pl-4">
                  <Link href={`/contacts/${r.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-brand-subtle text-xs text-brand">{initials(r.fullName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.fullName}</p>
                      <p className="max-w-64 truncate text-xs text-muted-foreground">{r.title ?? "—"}</p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="max-w-56 truncate">{r.companyName ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {r.roleFamily && <Badge variant="secondary">{r.roleFamily}</Badge>}
                    {r.seniority && <Badge variant="outline">{r.seniority}</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{place(r)}</TableCell>
                <TableCell className="pr-4 text-right text-muted-foreground">
                  {r.lastContactedAt ? timeAgo(r.lastContactedAt) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/contacts/${r.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 active:bg-muted/50">
              <Avatar className="size-10">
                <AvatarFallback className="bg-brand-subtle text-brand">{initials(r.fullName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.fullName}</p>
                <p className="truncate text-sm text-muted-foreground">{[r.title, r.companyName].filter(Boolean).join(" · ") || "—"}</p>
                {r.roleFamily && (
                  <div className="mt-1 flex gap-1">
                    <Badge variant="secondary">{r.roleFamily}</Badge>
                  </div>
                )}
              </div>
              <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
