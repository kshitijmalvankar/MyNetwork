"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, ChevronRightIcon, FlipHorizontal2Icon, RotateCcwIcon, ScanLineIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { discardScan, rereadScan } from "@/app/(app)/review/actions";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { timeAgo } from "@/lib/format";
import type { QueueItem } from "@/lib/scans/queries";
import { useScanUpdates } from "./use-scan-updates";

function Thumb({ id }: { id: string }) {
  return (
    // Decrypted on the server for the signed-in owner only.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/scans/${id}/image?side=thumb`} alt="" loading="lazy" className="aspect-[7/4] w-28 shrink-0 rounded-lg border bg-muted object-cover sm:w-36" />
  );
}

function Row({ item }: { item: QueueItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const act = (fn: () => Promise<{ ok: boolean; message?: string }>, success: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else toast.error(res.message);
    });

  const reading = item.status === "uploaded" || item.status === "processing";

  const body = (
    <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
      <Thumb id={item.id} />
      <div className="min-w-0 flex-1 space-y-1">
        {reading ? (
          <p className="flex items-center gap-2 font-medium text-muted-foreground">
            <Spinner className="size-4" /> Reading card…
          </p>
        ) : item.status === "failed" ? (
          <p className="font-medium text-destructive">Couldn&apos;t read this card</p>
        ) : (
          <p className="truncate font-medium">{item.name ?? "Unnamed card"}</p>
        )}
        <p className="truncate text-sm text-muted-foreground">
          {item.status === "failed" ? item.error : item.subtitle ?? (reading ? "This usually takes a few seconds" : "")}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{timeAgo(item.createdAt)}</span>
          {item.hasBack && (
            <span className="flex items-center gap-1">
              <FlipHorizontal2Icon className="size-3" /> 2 sides
            </span>
          )}
          {item.status === "needs_review" && item.issues > 0 && (
            <Badge variant="outline" className="gap-1 border-warning/50 text-warning">
              <AlertTriangleIcon className="size-3" /> Check {item.issues} {item.issues === 1 ? "field" : "fields"}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <li className="flex items-center gap-2 rounded-xl border bg-card p-2 pr-3 transition-colors has-[a:hover]:bg-muted/40">
      {item.status === "needs_review" ? (
        <Link href={`/review/${item.id}`} className="flex min-w-0 flex-1 items-center gap-2">
          {body}
          <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : (
        <>
          {body}
          {item.status === "failed" && (
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => act(() => rereadScan(item.id), "Trying again with a stronger model")}>
                {pending ? <Spinner /> : <RotateCcwIcon />} <span className="hidden sm:inline">Retry</span>
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} aria-label="Remove" onClick={() => act(() => discardScan(item.id), "Removed")}>
                <Trash2Icon />
              </Button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

export function ReviewQueue({ items, userId }: { items: QueueItem[]; userId: string }) {
  const inFlight = items.some((i) => i.status === "uploaded" || i.status === "processing");
  useScanUpdates(userId, { poll: inFlight });

  if (items.length === 0) {
    return (
      <EmptyState icon={ScanLineIcon} title="All caught up" description="Scanned cards show up here so you can check them before they're saved.">
        <Button asChild>
          <Link href="/scan">
            <ScanLineIcon /> Scan a card
          </Link>
        </Button>
      </EmptyState>
    );
  }

  const ready = items.filter((i) => i.status === "needs_review").length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {ready} ready to review{inFlight ? " · more on the way" : ""}
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>
    </div>
  );
}
