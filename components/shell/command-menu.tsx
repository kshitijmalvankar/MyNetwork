"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon, UserIcon } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { Button } from "@/components/ui/button";
import { primaryNav, secondaryNav } from "@/lib/nav";

type ContactHit = { id: string; name: string; subtitle: string | null };

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ContactHit[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (res.ok) setHits(((await res.json()) as { contacts: ContactHit[] }).contacts);
      } catch {
        // aborted or offline; keep previous hits
      }
    }, 150);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <>
      <Button
        variant="outline"
        className="h-8 w-full justify-start gap-2 rounded-lg bg-muted/40 text-muted-foreground shadow-none sm:w-64"
        onClick={() => setOpen(true)}
      >
        <SearchIcon className="size-4" />
        <span className="flex-1 text-left">Search people…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a person or page">
        <CommandInput placeholder="Search people, companies, pages…" value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          {query.trim().length >= 2 && hits.length > 0 && (
            <CommandGroup heading="People">
              {hits.map((c) => (
                <CommandItem key={c.id} value={`person ${c.name} ${c.subtitle ?? ""}`} onSelect={() => go(`/contacts/${c.id}`)}>
                  <UserIcon />
                  <span>{c.name}</span>
                  {c.subtitle && <span className="ml-2 truncate text-muted-foreground">{c.subtitle}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandSeparator />
          <CommandGroup heading="Go to">
            {[...primaryNav, ...secondaryNav].map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.label} ${(item.keywords ?? []).join(" ")}`}
                onSelect={() => go(item.href)}
              >
                <item.icon />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
