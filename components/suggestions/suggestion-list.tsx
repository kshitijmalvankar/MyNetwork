"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { BellPlusIcon, BriefcaseIcon, HashIcon, HourglassIcon, PlusIcon, SparklesIcon, WaypointsIcon, XIcon, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { acceptFinding, acceptSuggestion, dismissSuggestion } from "@/app/(app)/contacts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDay } from "@/lib/dates";
import { timeAgo } from "@/lib/format";
import type { Suggestion } from "@/lib/suggestions";
import { cn } from "@/lib/utils";

const addDays = (isoDay: string, days: number) => {
  const d = new Date(`${isoDay}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const first = (name: string) => name.split(/\s+/)[0];

/** The shared frame: icon, what's suggested, where it came from, and the buttons. */
function Row({ icon: Icon, s, showContact, title, source, children }: { icon: LucideIcon; s: Suggestion; showContact: boolean; title: string; source: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">
            {showContact && (
              <>
                <Link href={`/contacts/${s.contactId}`} className="font-medium text-foreground hover:underline">
                  {s.name}
                </Link>
                {s.subtitle && ` · ${s.subtitle}`}
                {" · "}
              </>
            )}
            {source}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </li>
  );
}

function Dismiss({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <Button size="icon-sm" variant="ghost" disabled={disabled} onClick={onClick} aria-label={`Dismiss: ${label}`} className="text-muted-foreground">
      <XIcon />
    </Button>
  );
}

function Item({ s, today, showContact, onDone }: { s: Suggestion; today: string; showContact: boolean; onDone: (id: string) => void }) {
  const [due, setDue] = useState(s.dueOn && s.dueOn >= today ? s.dueOn : addDays(today, s.kind === "reconnect" ? 2 : 3));
  const [topics, setTopics] = useState<string[]>(s.finding?.kind === "topics" ? s.finding.topics : []);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: boolean; message?: string }>, done?: string) =>
    startTransition(async () => {
      onDone(s.id);
      const res = await action();
      if (!res.ok) toast.error(res.message);
      else if (done) toast.success(done);
    });
  const dismiss = () => run(() => dismissSuggestion(s.id));

  const f = s.finding;
  if (f?.kind === "connection" && s.other) {
    const title =
      f.relation === "knows" ? `${first(s.name)} knows ${s.other.name}` : f.relation === "introduced_by" ? `${s.other.name} introduced you to ${first(s.name)}` : `${first(s.name)} introduced you to ${s.other.name}`;
    return (
      <Row icon={WaypointsIcon} s={s} showContact={showContact} title={title} source={f.evidence ? `“${f.evidence}” · from your note` : "From your note"}>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => acceptFinding(s.id), "Connection added")}>
          <PlusIcon data-icon="inline-start" />
          Add connection
        </Button>
        <Dismiss label={title} disabled={pending} onClick={dismiss} />
      </Row>
    );
  }
  if (f?.kind === "past_job") {
    const title = `${first(s.name)} used to work at ${f.company}${f.title ? ` as ${f.title}` : ""}`;
    return (
      <Row icon={BriefcaseIcon} s={s} showContact={showContact} title={title} source="From your note">
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => acceptFinding(s.id), "Added to past jobs")}>
          <PlusIcon data-icon="inline-start" />
          Add to past jobs
        </Button>
        <Dismiss label={title} disabled={pending} onClick={dismiss} />
      </Row>
    );
  }
  if (f?.kind === "topics") {
    const title = `What ${first(s.name)} works on`;
    return (
      <Row icon={HashIcon} s={s} showContact={showContact} title={title} source="From your note · tap a topic to leave it out">
        <ul className="flex w-full flex-wrap gap-1.5">
          {f.topics.map((t) => {
            const kept = topics.includes(t);
            return (
              <li key={t}>
                <button
                  type="button"
                  aria-pressed={kept}
                  onClick={() => setTopics((list) => (kept ? list.filter((x) => x !== t) : [...list, t]))}
                  className={cn("rounded-full px-2.5 py-0.5 text-xs transition-colors", kept ? "bg-brand-subtle text-brand" : "bg-muted text-muted-foreground line-through")}
                >
                  {t}
                </button>
              </li>
            );
          })}
        </ul>
        <Button size="sm" variant="outline" disabled={pending || topics.length === 0} onClick={() => run(() => acceptFinding(s.id, { topics }), "Topics added")}>
          <PlusIcon data-icon="inline-start" />
          Add {topics.length === 1 ? "topic" : "topics"}
        </Button>
        <Dismiss label={title} disabled={pending} onClick={dismiss} />
      </Row>
    );
  }

  const text = s.kind === "reconnect" ? `Get back in touch with ${first(s.name)}` : (s.text ?? "Follow up");
  return (
    <Row
      icon={s.kind === "reconnect" ? HourglassIcon : SparklesIcon}
      s={s}
      showContact={showContact}
      title={text}
      source={
        s.kind === "reconnect" ? `Last in touch ${s.lastContact ? timeAgo(s.lastContact) : "a while ago"}` : s.dueOn ? `From your note · mentioned for ${formatDay(s.dueOn)}` : "From your note"
      }
    >
      <Input
        type="date"
        value={due}
        min={today}
        onChange={(e) => e.target.value && setDue(e.target.value)}
        className="h-7 w-auto px-2 text-xs"
        aria-label="Reminder date"
      />
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => acceptSuggestion(s.id, { dueOn: due, text }), `Reminder added for ${formatDay(due)}`)}>
        <BellPlusIcon data-icon="inline-start" />
        Add reminder
      </Button>
      <Dismiss label={text} disabled={pending} onClick={dismiss} />
    </Row>
  );
}

/** Suggestions to approve or dismiss. Nothing is added unless the user accepts it. */
export function SuggestionList({ items, today, showContact = true }: { items: Suggestion[]; today: string; showContact?: boolean }) {
  const [visible, hide] = useOptimistic(items, (list, id: string) => list.filter((s) => s.id !== id));
  if (visible.length === 0) return <p className="text-sm text-muted-foreground">All caught up.</p>;
  return (
    <ul>
      {visible.map((s) => (
        <Item key={s.id} s={s} today={today} showContact={showContact} onDone={hide} />
      ))}
    </ul>
  );
}
