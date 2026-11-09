"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlusIcon, SearchIcon, WaypointsIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { addConnection, removeConnection } from "@/app/(app)/contacts/actions";
import { PersonAvatar } from "@/components/contacts/person-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import type { ConnectedPerson, ProfileConnections } from "@/lib/contacts/connections";

function PersonLine({ person, caption, action }: { person: ConnectedPerson; caption?: string; action?: React.ReactNode }) {
  return (
    <li className="group flex items-center gap-3">
      <Link href={`/contacts/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1.5">
        <PersonAvatar name={person.name} className="size-8 text-xs" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{person.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{caption ?? person.subtitle ?? "—"}</span>
        </span>
      </Link>
      {action}
    </li>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul>{children}</ul>
    </section>
  );
}

/** People this person knows, introduced you to, or worked with, and who else is at their company. */
export function ConnectionsCard({ contactId, name, connections }: { contactId: string; name: string; connections: ProfileConnections }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const { stated, workedTogether, colleagues, colleaguesTotal, company } = connections;
  const nothing = stated.length + workedTogether.length + colleagues.length === 0;

  const remove = (linkId: string) =>
    startTransition(async () => {
      const res = await removeConnection(contactId, linkId);
      if (!res.ok) return void toast.error(res.message);
      router.refresh();
    });

  return (
    <Card className="gap-4">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <WaypointsIcon className="size-4 text-brand" /> Connections
        </CardTitle>
        <Button size="sm" variant="ghost" aria-label="Add a connection" onClick={() => setAdding(true)}>
          <PlusIcon /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {nothing && <p className="text-sm text-muted-foreground">No connections yet. Add who {name.split(/\s+/)[0]} knows, or who introduced you.</p>}
        {stated.length > 0 && (
          <Group title="Know each other">
            {stated.map((s) => (
              <PersonLine
                key={s.linkId}
                person={s.person}
                caption={s.caption}
                action={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove the connection with ${s.person.name}`}
                    disabled={pending}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    onClick={() => remove(s.linkId)}
                  >
                    <XIcon />
                  </Button>
                }
              />
            ))}
          </Group>
        )}
        {workedTogether.length > 0 && (
          <Group title="Worked together">
            {workedTogether.map((w) => (
              <PersonLine key={w.person.id} person={w.person} caption={w.caption} />
            ))}
          </Group>
        )}
        {company && colleagues.length > 0 && (
          <Group title={`Also at ${company.name}`}>
            {colleagues.map((c) => (
              <PersonLine key={c.id} person={c} />
            ))}
            {colleaguesTotal > colleagues.length && (
              <li>
                <Link href={`/contacts?company=${company.id}`} className="block py-1.5 text-xs font-medium text-brand hover:underline">
                  See all {colleaguesTotal} at {company.name}
                </Link>
              </li>
            )}
          </Group>
        )}
      </CardContent>
      <AddConnectionDialog contactId={contactId} name={name} open={adding} onOpenChange={setAdding} />
    </Card>
  );
}

type Found = { id: string; name: string; subtitle: string | null };

function AddConnectionDialog({ contactId, name, open, onOpenChange }: { contactId: string; name: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [picked, setPicked] = useState<Found | null>(null);
  const [kind, setKind] = useState<"knows" | "introduced_by" | "introduced">("knows");
  const [pending, startTransition] = useTransition();
  const first = name.split(/\s+/)[0];

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || picked) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const body = (await res.json()) as { contacts: Found[] };
        setResults(body.contacts.filter((c) => c.id !== contactId));
      } catch {}
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, picked, contactId]);

  const reset = () => {
    setQuery("");
    setResults([]);
    setPicked(null);
    setKind("knows");
  };

  const save = () =>
    picked &&
    startTransition(async () => {
      const res = await addConnection({ contactId, otherId: picked.id, kind });
      if (!res.ok) return void toast.error(res.message);
      toast.success(`Connected ${first} and ${picked.name.split(/\s+/)[0]}`);
      onOpenChange(false);
      reset();
      router.refresh();
    });

  const other = picked?.name.split(/\s+/)[0] ?? "they";
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {first} with someone</DialogTitle>
          <DialogDescription>Who they know, or who introduced you. It shows on both profiles and on the graph.</DialogDescription>
        </DialogHeader>
        {picked ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2">
              <PersonAvatar name={picked.name} className="size-8 text-xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{picked.name}</span>
                {picked.subtitle && <span className="block truncate text-xs text-muted-foreground">{picked.subtitle}</span>}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
                Change
              </Button>
            </div>
            <RadioGroup value={kind} onValueChange={(v) => setKind(v as typeof kind)} className="gap-3">
              {(
                [
                  ["knows", `${first} and ${other} know each other`],
                  ["introduced_by", `${other} introduced you to ${first}`],
                  ["introduced", `${first} introduced you to ${other}`],
                ] as const
              ).map(([value, label]) => (
                <div key={value} className="flex items-center gap-3">
                  <RadioGroupItem value={value} id={`link-${value}`} />
                  <Label htmlFor={`link-${value}`} className="font-normal">
                    {label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your contacts" aria-label="Search your contacts" className="h-10 pl-9" />
            </div>
            <ul className="max-h-64 overflow-y-auto">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setPicked(r)} className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-muted/70">
                    <PersonAvatar name={r.name} className="size-8 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.name}</span>
                      {r.subtitle && <span className="block truncate text-xs text-muted-foreground">{r.subtitle}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {query.trim().length >= 2 && results.length === 0 && <p className="px-2 text-sm text-muted-foreground">No one found yet.</p>}
          </div>
        )}
        <DialogFooter>
          <Button onClick={save} disabled={!picked || pending} className="bg-brand text-brand-foreground hover:bg-brand/90">
            {pending && <Spinner />} Connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
