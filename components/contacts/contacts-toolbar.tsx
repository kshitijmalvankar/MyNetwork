"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDownIcon, CheckIcon, ListFilterIcon, SearchIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { Facets } from "@/lib/contacts/queries";
import { cn } from "@/lib/utils";

const regionName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
};

type FilterKey = "company" | "role" | "seniority" | "industry" | "country" | "event";

const FILTERS: { key: FilterKey; label: string; facet: keyof Facets }[] = [
  { key: "company", label: "Company", facet: "companies" },
  { key: "role", label: "Role", facet: "roleFamilies" },
  { key: "seniority", label: "Seniority", facet: "seniorities" },
  { key: "industry", label: "Industry", facet: "industries" },
  { key: "event", label: "Event", facet: "events" },
  { key: "country", label: "Country", facet: "countries" },
];

function labelFor(facets: Facets, key: FilterKey, value: string) {
  const f = FILTERS.find((x) => x.key === key)!;
  const hit = facets[f.facet].find((o) => o.value === value);
  if (key === "country") return regionName(value);
  return hit?.label ?? value;
}

export function ContactsToolbar({ facets }: { facets: Facets }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);

  const push = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  // Debounced search.
  useEffect(() => {
    if ((params.get("q") ?? "") === q.trim()) return;
    const t = setTimeout(() => push((p) => (q.trim() ? p.set("q", q.trim()) : p.delete("q"))), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = FILTERS.filter((f) => params.get(f.key));
  const sort = params.get("sort") ?? (params.get("q") ? "relevance" : "recent");

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <InputGroup className="h-10 flex-1">
          <InputGroupAddon>{pending ? <Spinner /> : <SearchIcon />}</InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search names, titles, companies, cities…"
            aria-label="Search contacts"
          />
          {q && (
            <InputGroupAddon align="inline-end">
              <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground">
                <XIcon className="size-4" />
              </button>
            </InputGroupAddon>
          )}
        </InputGroup>
        <div className="flex gap-2">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 flex-1 sm:flex-none">
                <ListFilterIcon /> Filter
                {active.length > 0 && <Badge className="ml-1 h-5 min-w-5 rounded-full bg-brand px-1.5 text-brand-foreground">{active.length}</Badge>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0" align="end">
              <Command>
                <CommandInput placeholder="Filter by…" />
                <CommandList className="max-h-96">
                  <CommandEmpty>Nothing to filter by yet.</CommandEmpty>
                  {FILTERS.map((f, idx) =>
                    facets[f.facet].length === 0 ? null : (
                      <div key={f.key}>
                        {idx > 0 && <CommandSeparator />}
                        <CommandGroup heading={f.label}>
                          {facets[f.facet].map((o) => {
                            const selected = params.get(f.key) === o.value;
                            return (
                              <CommandItem
                                key={`${f.key}-${o.value}`}
                                value={`${f.label} ${o.label ?? (f.key === "country" ? regionName(o.value) : o.value)}`}
                                onSelect={() => {
                                  push((p) => (selected ? p.delete(f.key) : p.set(f.key, o.value)));
                                  setOpen(false);
                                }}
                              >
                                <CheckIcon className={cn("size-4", selected ? "opacity-100" : "opacity-0")} />
                                <span className="flex-1 truncate">{f.key === "country" ? regionName(o.value) : (o.label ?? o.value)}</span>
                                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{o.count}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </div>
                    ),
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Select value={sort} onValueChange={(v) => push((p) => p.set("sort", v))}>
            <SelectTrigger className="h-10 w-auto min-w-36" aria-label="Sort">
              <ArrowUpDownIcon className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {params.get("q") && <SelectItem value="relevance">Best match</SelectItem>}
              <SelectItem value="recent">Recently added</SelectItem>
              <SelectItem value="contacted">Last contacted</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="company">Company</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {active.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((f) => (
            <Badge key={f.key} variant="secondary" className="h-7 gap-1 rounded-full pr-1 pl-3 text-sm font-normal">
              <span className="text-muted-foreground">{f.label}:</span> {labelFor(facets, f.key, params.get(f.key)!)}
              <button
                type="button"
                aria-label={`Remove ${f.label} filter`}
                onClick={() => push((p) => p.delete(f.key))}
                className="ml-0.5 flex size-5 items-center justify-center rounded-full hover:bg-background"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={() => push((p) => FILTERS.forEach((f) => p.delete(f.key)))}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
