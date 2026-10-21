"use client";

import { useState } from "react";
import { CalendarPlusIcon, CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type EventOption = { id: string; name: string; startsOn: string | null };
export type EventChoice = { eventId?: string; newEventName?: string };

/** Pick one of the user's events, or type a new one. */
export function EventPicker({ events, value, onChange }: { events: EventOption[]; value: EventChoice; onChange: (v: EventChoice) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = events.find((e) => e.id === value.eventId);
  const label = selected?.name ?? value.newEventName;
  const exact = events.some((e) => e.name.toLowerCase() === query.trim().toLowerCase());

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id="event" type="button" variant="outline" role="combobox" aria-expanded={open} className="h-10 flex-1 justify-between font-normal">
            <span className={cn("truncate", !label && "text-muted-foreground")}>
              {label ?? "Conference, meetup, dinner…"}
              {value.newEventName && <span className="ml-2 text-xs text-muted-foreground">(new)</span>}
            </span>
            <ChevronsUpDownIcon className="text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Search or name a new event…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{query.trim() ? null : "No events yet. Type a name to add one."}</CommandEmpty>
              {query.trim() && !exact && (
                <CommandGroup>
                  <CommandItem
                    value={`__new__${query}`}
                    onSelect={() => {
                      onChange({ newEventName: query.trim() });
                      setOpen(false);
                    }}
                  >
                    <CalendarPlusIcon /> Add “{query.trim()}”
                  </CommandItem>
                </CommandGroup>
              )}
              {events.length > 0 && (
                <CommandGroup heading="Your events">
                  {events.map((e) => (
                    <CommandItem
                      key={e.id}
                      value={`${e.name} ${e.id}`}
                      onSelect={() => {
                        onChange({ eventId: e.id });
                        setOpen(false);
                      }}
                    >
                      <CheckIcon className={cn("size-4", e.id === value.eventId ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{e.name}</span>
                      {e.startsOn && <span className="ml-auto text-xs text-muted-foreground">{e.startsOn}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {label && (
        <Button type="button" variant="ghost" size="icon-lg" aria-label="Clear event" onClick={() => onChange({})}>
          <XIcon />
        </Button>
      )}
    </div>
  );
}
