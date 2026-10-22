"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCompletion } from "@ai-sdk/react";
import { CheckIcon, CopyIcon, MailIcon, PenLineIcon, RefreshCwIcon, SaveIcon, SendIcon, SparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { logInteraction, saveAssistNote } from "@/app/(app)/contacts/actions";
import { AnswerMarkdown, plainAnswer } from "@/components/ask/markdown";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { timeAgo } from "@/lib/format";

type Props = {
  contactId: string;
  firstName: string;
  emails: string[];
  /** People and events the brief may link to. */
  knownIds: string[];
  quota: { used: number; quota: number };
  today: string;
};

function Writing() {
  return (
    <div className="space-y-2.5" aria-label="Writing…">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function useSaveNote(contactId: string) {
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const save = (kind: "brief" | "draft", body: string) =>
    startTransition(async () => {
      const res = await saveAssistNote(contactId, kind, body);
      if (!res.ok) return void toast.error(res.message);
      setSaved(true);
      toast.success(kind === "brief" ? "Brief saved to notes" : "Draft saved to notes");
      router.refresh();
    });
  return { save, saving, saved, reset: () => setSaved(false) };
}

/** Reads errors from our plain-text error responses. */
const errorText = (error: Error | undefined) => error?.message || "Something went wrong. Please try again.";

function BriefPanel({ contactId, firstName, knownIds, onUsed }: Pick<Props, "contactId" | "firstName" | "knownIds"> & { onUsed: () => void }) {
  const [purpose, setPurpose] = useState("");
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const known = useMemo(() => new Set(knownIds), [knownIds]);
  const note = useSaveNote(contactId);
  const { completion, complete, isLoading, error } = useCompletion({
    api: `/api/contacts/${contactId}/brief`,
    streamProtocol: "text",
    fetch: async (input, init) => {
      const res = await fetch(input, init);
      setCachedAt(res.headers.get("X-Brief-Cached-At"));
      return res;
    },
    onFinish: () => onUsed(),
  });
  // Open the panel, get the brief (usually from today's cache, so it's free).
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void complete("", { body: { purpose: "" } });
  }, [complete]);

  const write = (refresh: boolean) => {
    note.reset();
    void complete("", { body: { purpose: purpose.trim(), refresh } });
  };

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
      {error && !isLoading ? (
        <Alert variant="destructive">
          <AlertDescription>{errorText(error)}</AlertDescription>
        </Alert>
      ) : !completion ? (
        <Writing />
      ) : (
        <div className="rounded-xl border bg-card p-4">
          <AnswerMarkdown text={completion} knownIds={known} />
        </div>
      )}

      {completion && !isLoading && (
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={plainAnswer(completion)} />
          <Button variant="outline" size="sm" disabled={note.saving || note.saved} onClick={() => note.save("brief", plainAnswer(completion))}>
            {note.saved ? <CheckIcon data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
            {note.saved ? "Saved" : "Save to notes"}
          </Button>
          {cachedAt && (
            <span className="text-xs text-muted-foreground">
              Written {timeAgo(cachedAt)} ·{" "}
              <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={() => write(true)}>
                write a fresh one
              </button>
            </span>
          )}
        </div>
      )}

      <form
        className="mt-auto space-y-2 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          write(true);
        }}
      >
        <Field>
          <FieldLabel htmlFor="brief-purpose">What&apos;s the meeting about? (optional)</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="brief-purpose"
              value={purpose}
              maxLength={300}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder={`e.g. Pitching our pilot to ${firstName}`}
            />
            <Button type="submit" variant="outline" disabled={isLoading || !purpose.trim()}>
              <RefreshCwIcon data-icon="inline-start" />
              Tailor
            </Button>
          </div>
        </Field>
      </form>
    </div>
  );
}

function parseDraft(text: string) {
  const match = /^\s*subject:\s*(.*)\n+/i.exec(text);
  return match ? { subject: match[1].trim(), body: text.slice(match[0].length).trim() } : { subject: "", body: text.trim() };
}

type Channel = "email" | "message";
type Tone = "warm" | "professional" | "casual";

function DraftPanel({ contactId, firstName, emails, today, onUsed }: Pick<Props, "contactId" | "firstName" | "emails" | "today"> & { onUsed: () => void }) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>(emails.length ? "email" : "message");
  const [tone, setTone] = useState<Tone>("warm");
  const [intent, setIntent] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [logging, startLogging] = useTransition();
  const [logged, setLogged] = useState(false);
  const note = useSaveNote(contactId);
  const { completion, complete, isLoading, error } = useCompletion({
    api: `/api/contacts/${contactId}/draft`,
    streamProtocol: "text",
    onFinish: (_prompt, text) => {
      const parsed = parseDraft(text);
      setSubject(parsed.subject);
      setBody(parsed.body);
      onUsed();
    },
  });

  const write = () => {
    note.reset();
    setLogged(false);
    setBody("");
    setSubject("");
    void complete("", { body: { channel, tone, intent: intent.trim() || undefined } });
  };

  const live = isLoading ? parseDraft(completion) : null;
  const done = !isLoading && body !== "";
  const fullText = channel === "email" && subject ? `Subject: ${subject}\n\n${body}` : body;
  const mailto = emails[0] ? `mailto:${emails[0]}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;

  const markSent = () =>
    startLogging(async () => {
      const res = await logInteraction(contactId, { type: channel === "email" ? "email" : "message", metOn: today });
      if (!res.ok) return void toast.error(res.message);
      setLogged(true);
      toast.success(`Logged in ${firstName}'s history`);
      router.refresh();
    });

  return (
    <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          write();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel>Type</FieldLabel>
            <ToggleGroup type="single" variant="outline" value={channel} onValueChange={(v) => v && setChannel(v as Channel)} className="w-full">
              <ToggleGroupItem value="email" className="flex-1">
                Email
              </ToggleGroupItem>
              <ToggleGroupItem value="message" className="flex-1">
                Message
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <Field>
            <FieldLabel htmlFor="draft-tone">Tone</FieldLabel>
            <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
              <SelectTrigger id="draft-tone" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="casual">Short and casual</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="draft-intent">What should it say? (optional)</FieldLabel>
          <Textarea
            id="draft-intent"
            value={intent}
            maxLength={500}
            onChange={(e) => setIntent(e.target.value)}
            placeholder="e.g. Thank them for the chat and share our case study"
            className="min-h-16"
          />
        </Field>
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          <SparklesIcon data-icon="inline-start" />
          {done || completion ? "Write another" : "Write draft"}
        </Button>
      </form>

      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertDescription>{errorText(error)}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="space-y-3 rounded-xl border bg-card p-4 text-[15px] leading-relaxed">
          {!completion ? (
            <Writing />
          ) : (
            <>
              {live?.subject && <p className="font-medium">{live.subject}</p>}
              <p className="whitespace-pre-wrap">{live?.body}</p>
            </>
          )}
        </div>
      )}

      {done && (
        <div className="space-y-3">
          <Badge variant="secondary" className="gap-1">
            <SparklesIcon className="size-3" /> AI draft · check it, then send it yourself
          </Badge>
          {channel === "email" && (
            <Field>
              <FieldLabel htmlFor="draft-subject">Subject</FieldLabel>
              <Input id="draft-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </Field>
          )}
          <Field>
            <FieldLabel htmlFor="draft-body" className="sr-only">
              Message
            </FieldLabel>
            <Textarea id="draft-body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-56 text-[15px] leading-relaxed" />
          </Field>
          <div className="flex flex-wrap gap-2">
            {channel === "email" && mailto && (
              <Button size="sm" asChild>
                <a href={mailto}>
                  <MailIcon data-icon="inline-start" />
                  Open in email app
                </a>
              </Button>
            )}
            <CopyButton text={fullText} />
            <Button variant="outline" size="sm" disabled={note.saving || note.saved} onClick={() => note.save("draft", fullText)}>
              {note.saved ? <CheckIcon data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
              {note.saved ? "Saved" : "Save to notes"}
            </Button>
            <Button variant="ghost" size="sm" disabled={logging || logged} onClick={markSent}>
              {logged ? <CheckIcon data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
              {logged ? "Logged" : "I sent it"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** "Brief me" and "Draft a follow-up" for one contact. Everything here is a suggestion; nothing is sent. */
export function AssistCard(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState<"brief" | "draft" | null>(null);
  const left = Math.max(0, props.quota.quota - props.quota.used);
  const onUsed = () => router.refresh();

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SparklesIcon className="size-4 text-brand" /> Get ready
        </CardTitle>
        <CardDescription>A quick brief before you meet, or a follow-up to send. Written from your notes and history.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => setOpen("brief")}>
            <SparklesIcon data-icon="inline-start" />
            Brief me
          </Button>
          <Button variant="outline" onClick={() => setOpen("draft")}>
            <PenLineIcon data-icon="inline-start" />
            Draft follow-up
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {left} of {props.quota.quota} briefs and drafts left this month. Opening the same brief again the same day is free.
        </p>
      </CardContent>

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{open === "draft" ? `Follow up with ${props.firstName}` : `Brief: ${props.firstName}`}</SheetTitle>
            <SheetDescription>
              {open === "draft"
                ? "Pick a style, then edit the draft and send it yourself."
                : "From your notes and history. Check anything important."}
            </SheetDescription>
          </SheetHeader>
          {open === "brief" && <BriefPanel {...props} onUsed={onUsed} />}
          {open === "draft" && <DraftPanel {...props} onUsed={onUsed} />}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
