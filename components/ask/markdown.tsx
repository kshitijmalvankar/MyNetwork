"use client";

import { memo } from "react";
import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform, type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const INTERNAL = /^(contact|event):([0-9a-f-]{36})$/i;

/** Keeps our `contact:` / `event:` links; everything else gets the default (safe) treatment. */
const urlTransform = (url: string) => (INTERNAL.test(url) ? url : defaultUrlTransform(url));

/**
 * Renders an answer. `[Name](contact:<id>)` becomes a link to that person, but
 * only for ids the tools actually returned in this conversation, so a made-up
 * id shows as plain text instead of a broken link.
 */
export const AnswerMarkdown = memo(function AnswerMarkdown({ text, knownIds }: { text: string; knownIds: ReadonlySet<string> }) {
  const components: Components = {
    a: ({ href, children }) => {
      const internal = href?.match(INTERNAL);
      if (internal) {
        const [, kind, id] = internal;
        if (!knownIds.has(id)) return <span className="font-medium">{children}</span>;
        return (
          <Link
            href={kind === "contact" ? `/contacts/${id}` : `/events/${id}`}
            className="font-medium text-brand underline-offset-4 hover:underline focus-visible:underline"
          >
            {children}
          </Link>
        );
      }
      if (!href) return <span>{children}</span>;
      return (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline underline-offset-4">
          {children}
        </a>
      );
    },
    p: ({ children }) => <p className="leading-relaxed [&:not(:first-child)]:mt-3">{children}</p>,
    ul: ({ children }) => <ul className="mt-3 space-y-1.5 pl-5 first:mt-0 [&>li]:list-disc [&>li]:marker:text-muted-foreground">{children}</ul>,
    ol: ({ children }) => <ol className="mt-3 space-y-1.5 pl-5 first:mt-0 [&>li]:list-decimal [&>li]:marker:text-muted-foreground">{children}</ol>,
    li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    h1: ({ children }) => <p className="mt-4 font-semibold first:mt-0">{children}</p>,
    h2: ({ children }) => <p className="mt-4 font-semibold first:mt-0">{children}</p>,
    h3: ({ children }) => <p className="mt-4 font-semibold first:mt-0">{children}</p>,
    code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
    table: ({ children }) => (
      <div className="mt-3 overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => <th className="border-b bg-muted/50 px-3 py-2 text-left font-medium">{children}</th>,
    td: ({ children }) => <td className="border-b px-3 py-2 align-top last:border-b-0">{children}</td>,
  };

  return (
    <div className={cn("text-[15px] text-foreground [overflow-wrap:anywhere]")}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});

/** The answer as plain text, for copying: links become their labels. */
export function plainAnswer(text: string) {
  return text.replace(/\[([^\]]+)\]\((?:contact|event):[0-9a-f-]{36}\)/gi, "$1").replace(/\*\*(.+?)\*\*/g, "$1");
}
