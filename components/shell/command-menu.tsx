"use client";

import { createContext, use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserIcon } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { primaryNav, secondaryNav } from "@/lib/nav";

type ContactHit = { id: string; name: string; subtitle: string | null };

const CommandMenuContext = createContext<{ open: () => void } | null>(null);

/** Opens the search palette from anywhere in the app (the rail, the phone's More sheet). */
export function useCommandMenu() {
  const ctx = use(CommandMenuContext);
  if (!ctx) throw new Error("useCommandMenu must be used inside <CommandMenuProvider>");
  return ctx;
}

/** The search palette: people and pages, opened with ⌘K or any search button. */
export function CommandMenuProvider({ children }: { children: React.ReactNode }) {
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
    <CommandMenuContext value={{ open: () => setOpen(true) }}>
      {children}
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a person or page">
        {/* The dialog is only the frame; the input and list need their own Command root. */}
        <Command>
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
        </Command>
      </CommandDialog>
    </CommandMenuContext>
  );
}
