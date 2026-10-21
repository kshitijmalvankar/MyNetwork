"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2Icon, CalendarDaysIcon, ExternalLinkIcon, MaximizeIcon, MessageCircleIcon, SearchIcon, UserIcon, XIcon } from "lucide-react";
import { ForceCanvas, KIND_COLORS, type ForceCanvasHandle } from "@/components/graph/force-canvas";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDay } from "@/lib/dates";
import { initials, timeAgo } from "@/lib/format";
import type { GraphData } from "@/lib/graph";
import { buildGraph, matchingPeople, similarTo, type GraphFilters, type GraphOptions, type NodeKind } from "@/lib/graph-model";
import { cn } from "@/lib/utils";

const ANY = "__any";
const ON = "data-[state=on]:border-brand/40 data-[state=on]:bg-brand-subtle data-[state=on]:text-brand";
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const country = (code: string) => {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
};

// The details panel sits beside the map only when there's room; otherwise it's a bottom drawer.
const wideQuery = "(min-width: 1280px)";
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(wideQuery);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(wideQuery).matches,
    () => true,
  );
}

function KindIcon({ kind, className }: { kind: NodeKind; className?: string }) {
  const Icon = kind === "person" ? UserIcon : kind === "company" ? Building2Icon : CalendarDaysIcon;
  return <Icon className={className} />;
}

function Legend() {
  const items: [NodeKind, string, string][] = [
    ["person", "People", "rounded-full"],
    ["company", "Companies", "rounded-[3px]"],
    ["event", "Events", "rotate-45 rounded-[2px]"],
  ];
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-background/85 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
      {items.map(([kind, label, shape]) => (
        <span key={kind} className="flex items-center gap-1.5">
          <span className={cn("inline-block size-2.5 bg-[var(--c)] dark:bg-[var(--cd)]", shape)} style={{ "--c": KIND_COLORS.light[kind], "--cd": KIND_COLORS.dark[kind] } as React.CSSProperties} />
          {label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-4 border-t border-dashed border-muted-foreground" />
        Similar background
      </span>
    </div>
  );
}

type Selection = { id: string; kind: NodeKind } | null;

function PersonRow({ id, data, onSelect, detail }: { id: string; data: GraphData; onSelect: (id: string) => void; detail?: React.ReactNode }) {
  const p = data.people.find((x) => x.id === id);
  if (!p) return null;
  const company = data.companies.find((c) => c.id === p.companyId)?.name;
  return (
    <li>
      <button type="button" onClick={() => onSelect(p.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent">
        <Avatar className="size-7">
          <AvatarFallback className="bg-brand-subtle text-[10px] text-brand">{initials(p.name)}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{p.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{[p.title, company].filter(Boolean).join(" · ") || "—"}</span>
          {detail}
        </span>
      </button>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Details({ selection, data, onSelect, onShowOnly }: { selection: NonNullable<Selection>; data: GraphData; onSelect: (id: string) => void; onShowOnly: (ids: string[]) => void }) {
  if (selection.kind === "person") {
    const p = data.people.find((x) => x.id === selection.id)!;
    const company = data.companies.find((c) => c.id === p.companyId);
    const colleagues = company ? data.people.filter((x) => x.companyId === company.id && x.id !== p.id) : [];
    const events = data.metAt.filter(([pid]) => pid === p.id).map(([, e]) => data.events.find((x) => x.id === e)!).filter(Boolean);
    const similar = similarTo(data, p.id);
    return (
      <div className="space-y-5">
        <div className="space-y-2 px-2">
          <div className="flex flex-wrap gap-1.5">
            {p.roleFamily && <Badge variant="secondary">{p.roleFamily}</Badge>}
            {p.seniority && <Badge variant="outline">{p.seniority}</Badge>}
            {p.industry && <Badge variant="outline">{p.industry}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {[p.city, p.country && country(p.country)].filter(Boolean).join(", ")}
            {(p.city || p.country) && " · "}
            Last in touch {timeAgo(p.lastContact)}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" asChild>
              <Link href={`/contacts/${p.id}`}>
                <ExternalLinkIcon data-icon="inline-start" />
                Open profile
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/ask?q=${encodeURIComponent(`Who else in my network could ${p.name.split(/\s+/)[0]} help, or help them?`)}`}>
                <MessageCircleIcon data-icon="inline-start" />
                Ask
              </Link>
            </Button>
          </div>
        </div>
        {similar.length > 0 && (
          <Section title="Similar background">
            <ul>
              {similar.map((s) => (
                <PersonRow
                  key={s.person.id}
                  id={s.person.id}
                  data={data}
                  onSelect={onSelect}
                  detail={
                    s.shared.length > 0 && <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">Both: {s.shared.join(", ")}</span>
                  }
                />
              ))}
            </ul>
          </Section>
        )}
        {company && (
          <Section title={`At ${company.name}`}>
            {colleagues.length ? (
              <ul>
                {colleagues.slice(0, 8).map((c) => (
                  <PersonRow key={c.id} id={c.id} data={data} onSelect={onSelect} />
                ))}
              </ul>
            ) : (
              <p className="px-2 text-sm text-muted-foreground">No one else from {company.name} yet.</p>
            )}
          </Section>
        )}
        {events.length > 0 && (
          <Section title="Met at">
            <ul>
              {events.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => onSelect(e.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent">
                    <CalendarDaysIcon className="size-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{e.name}</span>
                    {e.date && <span className="text-xs text-muted-foreground">{formatDay(e.date)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </div>
    );
  }

  const isCompany = selection.kind === "company";
  const hub = isCompany ? data.companies.find((c) => c.id === selection.id)! : data.events.find((e) => e.id === selection.id)!;
  const people = isCompany
    ? data.people.filter((p) => p.companyId === selection.id).map((p) => p.id)
    : data.metAt.filter(([, e]) => e === selection.id).map(([p]) => p);
  const ev = !isCompany ? (hub as GraphData["events"][number]) : null;
  return (
    <div className="space-y-5">
      <div className="space-y-2 px-2">
        <p className="text-xs text-muted-foreground">
          {isCompany
            ? [(hub as GraphData["companies"][number]).industry, `${people.length} ${people.length === 1 ? "person" : "people"}`].filter(Boolean).join(" · ")
            : [ev?.date && formatDay(ev.date), ev?.location, `${people.length} ${people.length === 1 ? "person" : "people"} met`].filter(Boolean).join(" · ")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onShowOnly(people)}>
            Show only them
          </Button>
          {!isCompany && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/events/${selection.id}`}>
                <ExternalLinkIcon data-icon="inline-start" />
                Open event
              </Link>
            </Button>
          )}
        </div>
      </div>
      <Section title="People">
        <ul>
          {people.map((id) => (
            <PersonRow key={id} id={id} data={data} onSelect={onSelect} />
          ))}
        </ul>
      </Section>
    </div>
  );
}

function ListView({ data, emphasis, onSelect }: { data: GraphData; emphasis: Set<string> | null; onSelect: (id: string) => void }) {
  const visible = (ids: string[]) => (emphasis ? ids.filter((id) => emphasis.has(id)) : ids);
  const groups = [
    ...data.companies.map((c) => ({ id: c.id, kind: "company" as const, name: c.name, people: visible(data.people.filter((p) => p.companyId === c.id).map((p) => p.id)) })),
    ...data.events.map((e) => ({ id: e.id, kind: "event" as const, name: e.name, people: visible(data.metAt.filter(([, x]) => x === e.id).map(([p]) => p)) })),
  ]
    .filter((g) => g.people.length > 0)
    .sort((a, b) => b.people.length - a.people.length || a.name.localeCompare(b.name));
  if (groups.length === 0) return <p className="p-6 text-sm text-muted-foreground">No one matches these filters.</p>;
  return (
    <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
      {groups.map((g) => (
        <section key={g.id} className="rounded-xl border bg-background p-2">
          <button type="button" onClick={() => onSelect(g.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent">
            <KindIcon kind={g.kind} className="size-4 text-muted-foreground" />
            <span className="flex-1 truncate text-sm font-semibold">{g.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{g.people.length}</span>
          </button>
          <ul>
            {g.people.slice(0, 12).map((id) => (
              <PersonRow key={id} id={id} data={data} onSelect={onSelect} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function GraphExplorer({ data, initialFocus, initialPeople }: { data: GraphData; initialFocus?: string; initialPeople?: string[] }) {
  const router = useRouter();
  const wide = useWide();
  const canvas = useRef<ForceCanvasHandle>(null);
  const [view, setView] = useState<"map" | "list">("map");
  // Similar-background links start hidden (they tangle the map); a selected person always shows theirs.
  const [layers, setLayers] = useState<(keyof GraphOptions)[]>(["companies", "events"]);
  const [filters, setFilters] = useState<GraphFilters>({});
  const [only, setOnly] = useState<Set<string> | null>(initialPeople?.length ? new Set(initialPeople) : null);
  const [selection, setSelection] = useState<Selection>(() => {
    if (!initialFocus) return null;
    const kind: NodeKind | null = data.people.some((p) => p.id === initialFocus)
      ? "person"
      : data.companies.some((c) => c.id === initialFocus)
        ? "company"
        : data.events.some((e) => e.id === initialFocus)
          ? "event"
          : null;
    return kind ? { id: initialFocus, kind } : null;
  });

  const options = useMemo<GraphOptions>(() => ({ companies: layers.includes("companies"), events: layers.includes("events"), similar: true }), [layers]);
  const graph = useMemo(() => buildGraph(data, options), [data, options]);
  const companyName = useCallback((id: string) => data.companies.find((c) => c.id === id)?.name, [data]);

  // Bright nodes: people matching the filters (and/or the set from Ask), plus the hubs they connect to.
  const emphasis = useMemo(() => {
    const matched = matchingPeople(data.people, filters, companyName);
    const people = only && matched ? new Set([...only].filter((id) => matched.has(id))) : (only ?? matched);
    if (!people) return null;
    const bright = new Set(people);
    for (const l of graph.links) if (l.kind !== "similar" && people.has(l.source)) bright.add(l.target);
    return bright;
  }, [data.people, filters, companyName, only, graph.links]);

  const matchCount = emphasis ? data.people.filter((p) => emphasis.has(p.id)).length : data.people.length;
  const kindOf = useCallback(
    (id: string): NodeKind => (data.people.some((p) => p.id === id) ? "person" : data.companies.some((c) => c.id === id) ? "company" : "event"),
    [data],
  );
  const select = useCallback(
    (id: string | null) => {
      setSelection(id ? { id, kind: kindOf(id) } : null);
      if (id && view === "map") canvas.current?.focus(id);
    },
    [kindOf, view],
  );

  const options_ = (values: (string | null)[]) => [...new Set(values.filter((v): v is string => Boolean(v)))].sort();
  const choices = {
    roleFamily: options_(data.people.map((p) => p.roleFamily)),
    seniority: options_(data.people.map((p) => p.seniority)),
    industry: options_(data.people.map((p) => p.industry)),
    country: options_(data.people.map((p) => p.country)),
  };
  const setFilter = (key: keyof GraphFilters, value: string) => setFilters((f) => ({ ...f, [key]: value === ANY ? undefined : value }));
  const anyFilter = Boolean(filters.roleFamily || filters.seniority || filters.industry || filters.country || filters.query);

  const title = selection
    ? selection.kind === "person"
      ? data.people.find((p) => p.id === selection.id)?.name
      : selection.kind === "company"
        ? companyName(selection.id)
        : data.events.find((e) => e.id === selection.id)?.name
    : null;
  const subtitle =
    selection?.kind === "person"
      ? (() => {
          const p = data.people.find((x) => x.id === selection.id);
          return [p?.title, p?.companyId && companyName(p.companyId)].filter(Boolean).join(" at ");
        })()
      : selection?.kind === "company"
        ? "Company"
        : selection
          ? "Event"
          : null;

  const details = selection && title && (
    <Details
      selection={selection}
      data={data}
      onSelect={(id) => select(id)}
      onShowOnly={(ids) => {
        setOnly(new Set(ids));
        requestAnimationFrame(() => canvas.current?.fit(new Set(ids)));
      }}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query ?? ""}
            onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value || undefined }))}
            placeholder="Name, company, title or city"
            className="pl-8"
            aria-label="Highlight people"
          />
        </div>
        {(
          [
            ["roleFamily", "Any role"],
            ["seniority", "Any seniority"],
            ["industry", "Any industry"],
            ["country", "Any country"],
          ] as const
        ).map(([key, placeholder]) =>
          choices[key].length > 1 ? (
            <Select key={key} value={filters[key] ?? ANY} onValueChange={(v) => setFilter(key, v)}>
              <SelectTrigger size="sm" className={cn("w-auto min-w-28", filters[key] && "border-brand/50")} aria-label={placeholder}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{placeholder}</SelectItem>
                {choices[key].map((v) => (
                  <SelectItem key={v} value={v}>
                    {key === "country" ? country(v) : v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null,
        )}
        {anyFilter && (
          <Button size="sm" variant="ghost" onClick={() => setFilters({})}>
            <XIcon data-icon="inline-start" />
            Clear
          </Button>
        )}
        <div className="flex items-center gap-2 sm:ml-auto">
          <ToggleGroup type="multiple" variant="outline" size="sm" value={layers} onValueChange={(v) => setLayers(v as (keyof GraphOptions)[])} aria-label="Show on the map">
            <ToggleGroupItem value="companies" className={ON}>
              Companies
            </ToggleGroupItem>
            <ToggleGroupItem value="events" className={ON}>
              Events
            </ToggleGroupItem>
            <ToggleGroupItem value="similar" className={ON}>
              Similar
            </ToggleGroupItem>
          </ToggleGroup>
          <Tabs value={view} onValueChange={(v) => setView(v as "map" | "list")}>
            <TabsList>
              <TabsTrigger value="map">Map</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {(only || anyFilter) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/30 bg-brand-subtle px-3 py-2 text-sm">
          <span className="flex-1">
            Showing {matchCount} of {data.people.length} people
            {only && initialPeople?.length && only.size === initialPeople.length ? " from your question in Ask" : ""}.
          </span>
          {view === "map" && (
            <Button size="sm" variant="ghost" onClick={() => canvas.current?.fit(emphasis)}>
              <MaximizeIcon data-icon="inline-start" />
              Zoom to them
            </Button>
          )}
          {only && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOnly(null);
                router.replace("/graph", { scroll: false });
              }}
            >
              Show everyone
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative h-[calc(100dvh-19rem)] min-h-[420px] overflow-hidden rounded-xl border bg-card md:h-[calc(100dvh-15rem)]">
          {view === "map" ? (
            <>
              <ForceCanvas
                ref={canvas}
                nodes={graph.nodes}
                links={graph.links}
                selectedId={selection?.id ?? null}
                emphasis={emphasis}
                showSimilar={layers.includes("similar")}
                onSelect={(id) => setSelection(id ? { id, kind: kindOf(id) } : null)}
              />
              <Legend />
              <Button size="icon-sm" variant="outline" className="absolute top-3 right-3 bg-background/85 backdrop-blur" aria-label="Fit everything" onClick={() => canvas.current?.fit(emphasis)}>
                <MaximizeIcon />
              </Button>
            </>
          ) : (
            <div className="h-full overflow-y-auto">
              <ListView data={data} emphasis={emphasis} onSelect={select} />
            </div>
          )}
        </div>

        {wide ? (
          <aside className="h-[calc(100dvh-15rem)] min-h-[420px] overflow-y-auto rounded-xl border bg-card p-3">
            {selection && title ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 px-2 pt-1">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{title}</h2>
                    {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={() => setSelection(null)}>
                    <XIcon />
                  </Button>
                </div>
                {details}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                <UserIcon className="size-5" />
                Pick someone, a company or an event to see how they connect.
              </div>
            )}
          </aside>
        ) : (
          <Drawer open={selection !== null} onOpenChange={(open) => !open && setSelection(null)}>
            <DrawerContent className="max-h-[80dvh]">
              <DrawerHeader className="px-4 group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
                <DrawerTitle>{title}</DrawerTitle>
                {subtitle && <DrawerDescription>{subtitle}</DrawerDescription>}
              </DrawerHeader>
              <div className="overflow-y-auto px-2 pb-6">{details}</div>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    </div>
  );
}
