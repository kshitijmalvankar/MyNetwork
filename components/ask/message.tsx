"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  HashIcon,
  SearchIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react";
import type { AskUIMessage } from "@/lib/ai/ask";
import { AnswerMarkdown, plainAnswer } from "@/components/ask/markdown";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type Part = AskUIMessage["parts"][number];
export type Refs = { ids: Set<string>; names: Map<string, string> };

/** Every person and event id the tools returned in this conversation, with names where known. */
export function collectRefs(messages: AskUIMessage[]): Refs {
  const ids = new Set<string>();
  const names = new Map<string, string>();
  const add = (id?: string, name?: string) => {
    if (!id) return;
    ids.add(id);
    if (name) names.set(id, name);
  };
  for (const m of messages) {
    for (const p of m.parts) {
      if (!("state" in p) || p.state !== "output-available") continue;
      switch (p.type) {
        case "tool-findContacts":
          p.output.people.forEach((c) => add(c.id as string, c.name as string));
          break;
        case "tool-searchNotes":
          p.output.passages.forEach((x) => {
            add(x.contactId as string | undefined, x.person as string | undefined);
            add(x.eventId as string | undefined);
          });
          break;
        case "tool-getContact":
          if ("id" in p.output) {
            add(p.output.id as string, p.output.name as string);
            (p.output.history as { eventId?: string; event?: string }[] | undefined)?.forEach((h) => add(h?.eventId, h?.event));
          }
          break;
        case "tool-listFollowUps":
          [...p.output.followUps, ...(("laterFollowUps" in p.output && p.output.laterFollowUps) || [])].forEach((f) =>
            add(f.contactId as string | undefined, f.name as string | undefined),
          );
          break;
        case "tool-listEvents":
          p.output.events.forEach((e) => add(e.id as string, e.name as string));
          break;
      }
    }
  }
  return { ids, names };
}

type Activity = { key: string; icon: LucideIcon; label: string; running: boolean; failed: boolean };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function activityOf(part: Part, key: string): Activity | null {
  if (!part.type.startsWith("tool-") || !("state" in part)) return null;
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error";
  const done = part.state === "output-available";
  const base = { key, running, failed };
  switch (part.type) {
    case "tool-findContacts": {
      const what = [part.input?.company, part.input?.roleFamily, part.input?.title, part.input?.event, part.input?.city, part.input?.name]
        .filter(Boolean)
        .join(", ");
      return {
        ...base,
        icon: SearchIcon,
        label: done ? `Found ${plural(Number(part.output.total), "person", "people")}${what ? ` · ${what}` : ""}` : "Searching your contacts",
      };
    }
    case "tool-searchNotes":
      return { ...base, icon: FileTextIcon, label: done ? `Searched notes for “${part.input.query}”` : "Searching your notes" };
    case "tool-getContact":
      return { ...base, icon: UserIcon, label: done && "name" in part.output ? `Read ${part.output.name}'s details` : "Looking up details" };
    case "tool-countContacts":
      return { ...base, icon: HashIcon, label: done ? `Counted ${plural(Number(part.output.total), "person", "people")}` : "Counting" };
    case "tool-listFollowUps":
      if (!done) return { ...base, icon: BellIcon, label: "Checking follow-ups" };
      return {
        ...base,
        icon: BellIcon,
        label: part.output.laterFollowUps
          ? `${plural(part.output.followUps.length, "follow-up", "follow-ups")} due, ${part.output.laterFollowUps.length} later`
          : plural(part.output.followUps.length, "open follow-up", "open follow-ups"),
      };
    case "tool-listEvents":
      return {
        ...base,
        icon: CalendarIcon,
        label: done ? `${plural(part.output.events.length, "event", "events")}${part.input.name ? ` · ${part.input.name}` : ""}` : "Checking events",
      };
    default:
      return null;
  }
}

function ActivityList({ items }: { items: Activity[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="What I looked up">
      {items.map((a) => (
        <li
          key={a.key}
          className={cn(
            "inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground",
            a.failed && "border-destructive/30 text-destructive",
          )}
        >
          {a.running ? <Spinner className="size-3" /> : <a.icon className="size-3 shrink-0" />}
          <span className="truncate">{a.failed ? "A lookup failed" : a.label}</span>
        </li>
      ))}
    </ul>
  );
}

function Sources({ text, refs }: { text: string; refs: Refs }) {
  const people = [...new Set([...text.matchAll(/\]\(contact:([0-9a-f-]{36})\)/gi)].map((m) => m[1]))].filter((id) => refs.ids.has(id) && refs.names.has(id));
  if (people.length < 2) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {people.map((id) => (
        <Link
          key={id}
          href={`/contacts/${id}`}
          className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pr-2.5 pl-0.5 text-xs font-medium transition-colors hover:bg-accent"
        >
          <Avatar className="size-5">
            <AvatarFallback className="bg-brand-subtle text-[9px] text-brand">{initials(refs.names.get(id)!)}</AvatarFallback>
          </Avatar>
          {refs.names.get(id)}
        </Link>
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground"
      aria-label={copied ? "Copied" : "Copy answer"}
      onClick={async () => {
        await navigator.clipboard.writeText(plainAnswer(text));
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </Button>
  );
}

export function ChatMessage({ message, refs, streaming }: { message: AskUIMessage; refs: Refs; streaming: boolean }) {
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n\n")
    .trim();

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-brand-foreground [overflow-wrap:anywhere]">
          {text}
        </p>
      </div>
    );
  }

  const activity = message.parts.map((p, i) => activityOf(p, `${message.id}-${i}`)).filter((a): a is Activity => a !== null);
  return (
    <div className="group">
      <ActivityList items={activity} />
      {text && <AnswerMarkdown text={text} knownIds={refs.ids} />}
      {text && !streaming && (
        <>
          <Sources text={text} refs={refs} />
          <div className="mt-1 -ml-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
            <CopyButton text={text} />
          </div>
        </>
      )}
    </div>
  );
}
