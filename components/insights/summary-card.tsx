"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BellIcon, HourglassIcon, MessageCircleIcon, RefreshCwIcon, ScanLineIcon, SparklesIcon, WaypointsIcon } from "lucide-react";
import type { InsightSummary } from "@/lib/ai/insights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { timeAgo } from "@/lib/format";

type Response = { summary: InsightSummary | null; createdAt?: string; stale?: boolean; reason?: "few" | "paused" };
type Action = InsightSummary["actions"][number];

/** Each action kind maps to a fixed place in the app; the model never supplies a link. */
function actionLink(a: Action): { href: string; icon: typeof BellIcon } {
  switch (a.kind) {
    case "reconnect":
      return { href: "/home", icon: HourglassIcon };
    case "follow_ups":
      return { href: "/home", icon: BellIcon };
    case "scan":
      return { href: "/scan", icon: ScanLineIcon };
    case "graph":
      return { href: "/graph", icon: WaypointsIcon };
    case "ask":
      return { href: `/ask?q=${encodeURIComponent(a.question ?? "")}`, icon: MessageCircleIcon };
  }
}

export function SummaryCard() {
  const [state, setState] = useState<{ loading: boolean; data?: Response; error?: string }>({ loading: true });

  const load = async (refresh = false) => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const res = await fetch("/api/insights/summary", { method: refresh ? "POST" : "GET" });
      if (!res.ok) {
        const message = (await res.text()) || "Something went wrong.";
        return setState((s) => ({ ...s, loading: false, error: message }));
      }
      setState({ loading: false, data: (await res.json()) as Response });
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Couldn't reach the server." }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/insights/summary")
      .then(async (res) => (res.ok ? { data: (await res.json()) as Response } : { error: (await res.text()) || "Something went wrong." }))
      .catch(() => ({ error: "Couldn't reach the server." }))
      .then((r) => !cancelled && setState({ loading: false, ...r }));
    return () => {
      cancelled = true;
    };
  }, []);

  const { loading, data, error } = state;
  const summary = data?.summary;

  return (
    <Card className="gap-4 border-brand/30 shadow-none">
      <CardHeader className="flex flex-row flex-wrap items-center gap-2">
        <CardTitle className="flex flex-1 items-center gap-2 text-base">
          <SparklesIcon className="size-4 text-brand" /> This week
        </CardTitle>
        {summary && <Badge variant="secondary">AI summary</Badge>}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && !summary ? (
          <div className="space-y-2.5" aria-label="Writing your summary…">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : error && !summary ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {error}
            <Button size="sm" variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : !summary ? (
          <p className="text-sm text-muted-foreground">
            {data?.reason === "few"
              ? "Add a few more people and you'll get a short summary of your network here each week."
              : "Summaries are paused for today. Your numbers below are up to date."}
          </p>
        ) : (
          <>
            <p className="text-[15px] font-medium leading-relaxed">{summary.headline}</p>
            <ul className="space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground [&>li]:list-disc">
              {summary.observations.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
            {summary.actions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {summary.actions.map((a) => {
                  const { href, icon: Icon } = actionLink(a);
                  return (
                    <Button key={`${a.kind}-${a.label}`} size="sm" variant="outline" asChild>
                      <Link href={href}>
                        <Icon data-icon="inline-start" />
                        {a.label}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            )}
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {data?.createdAt && <span>Written {timeAgo(data.createdAt)} from your numbers.</span>}
              {data?.stale && <span>Your numbers have changed since.</span>}
              <button
                type="button"
                disabled={loading}
                onClick={() => void load(true)}
                className="inline-flex items-center gap-1 underline-offset-4 hover:text-foreground hover:underline disabled:opacity-60"
              >
                {loading ? <Spinner className="size-3" /> : <RefreshCwIcon className="size-3" />}
                Write a fresh one
              </button>
              {error && <span className="text-destructive">{error}</span>}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
