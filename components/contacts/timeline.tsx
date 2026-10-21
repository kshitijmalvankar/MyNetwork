"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDaysIcon,
  HandshakeIcon,
  MailIcon,
  MessageSquareIcon,
  PencilIcon,
  PhoneIcon,
  StickyNoteIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createNote, deleteInteraction, deleteNote, updateNote } from "@/app/(app)/contacts/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { TimelineItem } from "@/lib/contacts/queries";

const INTERACTION: Record<string, { label: string; icon: typeof HandshakeIcon }> = {
  met: { label: "Met", icon: HandshakeIcon },
  meeting: { label: "Meeting", icon: UsersIcon },
  call: { label: "Call", icon: PhoneIcon },
  email: { label: "Email", icon: MailIcon },
  message: { label: "Message", icon: MessageSquareIcon },
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function NoteComposer({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      const res = await createNote(contactId, body);
      if (!res.ok) return void toast.error(res.message);
      setBody("");
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note: what you talked about, their interests, who they know…"
        className="min-h-20"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) save();
        }}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={pending || !body.trim()}>
          {pending && <Spinner />} Add note
        </Button>
      </div>
    </div>
  );
}

function NoteItem({ contactId, item }: { contactId: string; item: Extract<TimelineItem, { kind: "note" }> }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.body);
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.message);
      setEditing(false);
      router.refresh();
    });

  return (
    <div className="group space-y-2">
      {editing ? (
        <>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-20" autoFocus />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={pending || !body.trim()} onClick={() => run(() => updateNote(contactId, item.id, body))}>
              {pending && <Spinner />} Save
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-2">
          <p className="flex-1 text-sm whitespace-pre-wrap">{item.body}</p>
          <div className="flex shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
            <Button size="icon-sm" variant="ghost" aria-label="Edit note" onClick={() => setEditing(true)}>
              <PencilIcon />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Delete note" disabled={pending} onClick={() => run(() => deleteNote(contactId, item.id))}>
              <Trash2Icon />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Timeline({ contactId, items }: { contactId: string; items: TimelineItem[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Notes &amp; history</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <NoteComposer contactId={contactId} />
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ol className="relative space-y-5 border-l pl-6">
            {items.map((item) => {
              const meta = item.kind === "note" ? { label: "Note", icon: StickyNoteIcon } : (INTERACTION[item.type] ?? INTERACTION.met);
              return (
                <li key={`${item.kind}-${item.id}`} className="relative">
                  <span className="absolute top-0.5 -left-[2.07rem] flex size-6 items-center justify-center rounded-full border bg-background">
                    <meta.icon className="size-3.5 text-muted-foreground" />
                  </span>
                  <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{meta.label}</span>
                    <span>{fmtDate(item.at)}</span>
                    {item.kind === "interaction" && item.event && (
                      <Link href={`/events/${item.event.id}`} className="inline-flex items-center gap-1 hover:text-foreground">
                        <CalendarDaysIcon className="size-3" /> {item.event.name}
                      </Link>
                    )}
                    {item.kind === "interaction" && (
                      <button
                        type="button"
                        className="ml-auto text-muted-foreground/70 hover:text-destructive"
                        aria-label="Remove from history"
                        onClick={() =>
                          startTransition(async () => {
                            const res = await deleteInteraction(contactId, item.id);
                            if (res.ok) router.refresh();
                          })
                        }
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {item.kind === "note" && <NoteItem contactId={contactId} item={item} />}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
