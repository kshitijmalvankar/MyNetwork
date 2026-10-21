"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUpIcon, HistoryIcon, MessageCircleIcon, PlusIcon, ScanLineIcon, SparklesIcon, SquareIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { AskUIMessage } from "@/lib/ai/ask";
import { MAX_QUESTION_CHARS } from "@/lib/ask/limits";
import { threadTitle, type ThreadSummary } from "@/lib/ask/title";
import { deleteThread } from "@/app/(app)/ask/actions";
import { ChatMessage, collectRefs } from "@/components/ask/message";
import { EmptyState } from "@/components/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  threadId: string;
  initialMessages: AskUIMessage[];
  isNew?: boolean;
  threads: ThreadSummary[];
  suggestions: string[];
  backlog: number;
  hasContacts: boolean;
};

function ThreadList({ threads, activeId, onDelete, onNavigate }: { threads: ThreadSummary[]; activeId: string; onDelete: (id: string) => void; onNavigate?: () => void }) {
  if (threads.length === 0) return <p className="px-2 py-3 text-sm text-muted-foreground">Your conversations will appear here.</p>;
  return (
    <ul className="space-y-0.5">
      {threads.map((t) => (
        <li key={t.id} className="group/thread relative">
          <Link
            href={`/ask/${t.id}`}
            onClick={onNavigate}
            aria-current={t.id === activeId ? "page" : undefined}
            className={cn(
              "block rounded-lg px-2.5 py-2 pr-9 text-sm transition-colors hover:bg-accent",
              t.id === activeId && "bg-accent font-medium",
            )}
          >
            <span className="line-clamp-1">{t.title}</span>
            <span className="text-xs font-normal text-muted-foreground">{timeAgo(t.updatedAt)}</span>
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete “${t.title}”`}
            className="absolute top-1/2 right-1 -translate-y-1/2 text-muted-foreground opacity-100 md:opacity-0 md:group-hover/thread:opacity-100 md:focus-visible:opacity-100"
            onClick={() => onDelete(t.id)}
          >
            <Trash2Icon />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function AskWorkspace({ threadId, initialMessages, isNew = false, threads: initialThreads, suggestions, backlog, hasContacts }: Props) {
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [input, setInput] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ThreadSummary | null>(null);
  const [, startTransition] = useTransition();
  const saved = useRef(!isNew);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, error, regenerate, clearError } = useChat<AskUIMessage>({
    id: threadId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // History lives on the server; only the new question is sent.
      prepareSendMessagesRequest: ({ id, messages }) => ({ body: { id, message: messages[messages.length - 1] } }),
    }),
    onFinish: ({ messages: all, isError }) => {
      if (isError) return;
      const now = new Date().toISOString();
      if (!saved.current) {
        // The server has saved the thread now, so it can have its own URL (without remounting).
        saved.current = true;
        window.history.replaceState(null, "", `/ask/${threadId}`);
        const first = all.find((m) => m.role === "user")?.parts.find((p) => p.type === "text")?.text ?? "New conversation";
        setThreads((list) => [{ id: threadId, title: threadTitle(first), updatedAt: now }, ...list.filter((t) => t.id !== threadId)]);
      } else {
        setThreads((list) => list.map((t) => (t.id === threadId ? { ...t, updatedAt: now } : t)));
      }
    },
  });

  const busy = status === "submitted" || status === "streaming";
  const refs = useMemo(() => collectRefs(messages), [messages]);

  // Keep the newest content in view while answering, unless the reader scrolled up.
  useEffect(() => {
    if (!busy) return;
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240;
    if (nearBottom) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  const ask = (text: string) => {
    const question = text.trim();
    if (!question || busy || question.length > MAX_QUESTION_CHARS) return;
    if (error) clearError();
    setInput("");
    void sendMessage({ text: question });
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" }));
  };

  const remove = (id: string) =>
    startTransition(async () => {
      const previous = threads;
      setThreads((list) => list.filter((t) => t.id !== id));
      setHistoryOpen(false);
      const res = await deleteThread(id);
      if (!res.ok) {
        setThreads(previous);
        toast.error("Couldn't delete that conversation.");
      } else if (id === threadId) {
        router.push("/ask");
      }
    });

  const history = (
    <ThreadList
      threads={threads}
      activeId={threadId}
      onDelete={(id) => setConfirmDelete(threads.find((t) => t.id === id) ?? null)}
      onNavigate={() => setHistoryOpen(false)}
    />
  );
  const newChat = (
    <Button variant="outline" size="sm" asChild>
      <Link href="/ask" onClick={() => setHistoryOpen(false)}>
        <PlusIcon data-icon="inline-start" />
        New chat
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 sm:px-6">
      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>“{confirmDelete?.title}” will be permanently deleted. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (confirmDelete) remove(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col gap-3 overflow-y-auto py-8 lg:flex">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-medium text-muted-foreground">Conversations</h2>
          {newChat}
        </div>
        {history}
      </aside>

      <section className="flex min-h-[calc(100dvh-3.5rem-7rem)] min-w-0 flex-1 flex-col md:min-h-[calc(100dvh-3.5rem)]">
        <div className="flex items-center justify-between gap-3 py-6 lg:py-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ask</h1>
            <p className="text-sm text-muted-foreground">Ask anything about the people you’ve met.</p>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Past conversations">
                  <HistoryIcon />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 gap-0">
                <SheetHeader>
                  <SheetTitle>Conversations</SheetTitle>
                </SheetHeader>
                <div className="overflow-y-auto px-2 pb-6">{history}</div>
              </SheetContent>
            </Sheet>
            {!isNew || messages.length > 0 ? newChat : null}
          </div>
        </div>

        {backlog > 0 && (
          <Alert className="mb-4">
            <Spinner className="size-4" />
            <AlertDescription>
              Getting {backlog === 1 ? "1 item" : `${backlog} items`} ready for search. Answers about notes may be incomplete for a minute.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex-1">
          {messages.length === 0 ? (
            hasContacts ? (
              <div className="flex flex-col items-center gap-6 py-10 text-center sm:py-16">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-subtle text-brand">
                  <SparklesIcon className="size-6" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-lg font-semibold">What would you like to know?</h2>
                  <p className="max-w-md text-sm text-muted-foreground">
                    Ask about people, companies, events or anything in your notes. Answers link to the people they mention.
                  </p>
                </div>
                <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => ask(s)}
                      className="rounded-xl border bg-card px-4 py-3 text-left text-sm transition-colors hover:border-brand/40 hover:bg-accent"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={MessageCircleIcon}
                title="Add a few people first"
                description="Scan some business cards, then ask things like “Who did I meet from XYZ?”"
              >
                <Button asChild>
                  <Link href="/scan">
                    <ScanLineIcon data-icon="inline-start" />
                    Scan cards
                  </Link>
                </Button>
              </EmptyState>
            )
          ) : (
            <div className="space-y-8 pb-6">
              {messages.map((m, i) => (
                <ChatMessage key={m.id} message={m} refs={refs} streaming={busy && i === messages.length - 1} />
              ))}
              {status === "submitted" && messages[messages.length - 1]?.role === "user" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  Thinking…
                </div>
              )}
              {error && (
                <Alert variant="destructive">
                  <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                    <span>{error.message || "Something went wrong. Please try again."}</span>
                    <Button size="sm" variant="outline" onClick={() => regenerate()}>
                      Try again
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 -mx-1 bg-gradient-to-t from-background from-70% to-transparent px-1 pt-4 pb-4 md:bottom-0"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <label htmlFor="ask-input" className="sr-only">
              Your question
            </label>
            <textarea
              id="ask-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              rows={1}
              maxLength={MAX_QUESTION_CHARS}
              disabled={!hasContacts}
              placeholder={hasContacts ? "Ask about your network…" : "Add people to start asking"}
              className="field-sizing-content max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
            />
            {busy ? (
              <Button type="button" size="icon" variant="secondary" aria-label="Stop" onClick={() => stop()} className="rounded-xl">
                <SquareIcon className="fill-current" />
              </Button>
            ) : (
              <Button type="submit" size="icon" aria-label="Send" disabled={!input.trim() || !hasContacts} className="rounded-xl bg-brand text-brand-foreground hover:bg-brand/90">
                <ArrowUpIcon />
              </Button>
            )}
          </div>
          <p className="mt-2 hidden text-center text-xs text-muted-foreground sm:block">
            Answers come only from your own contacts and notes. Check anything important.
          </p>
        </form>
      </section>
    </div>
  );
}
