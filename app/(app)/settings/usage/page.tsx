import type { Metadata } from "next";
import { GaugeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/dal";
import { formatDay } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getUsage, NEAR_LIMIT, type FeatureUsage } from "@/lib/usage";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Usage" };

function Meter({ f, resetsOn }: { f: FeatureUsage; resetsOn: string }) {
  const ratio = f.quota > 0 ? Math.min(1, f.used / f.quota) : 0;
  const full = f.quota > 0 && f.used >= f.quota;
  const near = !full && ratio >= NEAR_LIMIT;
  return (
    <li className="space-y-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium">{f.label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">{f.used.toLocaleString("en")}</span> of {f.quota.toLocaleString("en")} {f.unit}
        </span>
      </div>
      <div
        role="meter"
        aria-label={f.label}
        aria-valuemin={0}
        aria-valuemax={f.quota}
        aria-valuenow={Math.min(f.used, f.quota)}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-full rounded-full bg-[#2a78d6] dark:bg-[#3987e5]",
            near && "bg-warning dark:bg-warning",
            full && "bg-destructive dark:bg-destructive",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {(near || full) && (
        <p className={cn("text-xs", full ? "text-destructive" : "text-muted-foreground")}>
          {full
            ? `You've used all of this month's ${f.unit}. More on ${formatDay(resetsOn)}.`
            : `${(f.quota - f.used).toLocaleString("en")} ${f.unit} left until ${formatDay(resetsOn)}.`}
        </p>
      )}
    </li>
  );
}

export default async function UsagePage() {
  const user = await requireUser();
  const usage = await getUsage(await createClient(), user.id);

  return (
    <>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <GaugeIcon className="size-4 text-brand" /> This month
            <Badge variant="secondary">{usage.plan} plan</Badge>
          </CardTitle>
          <CardDescription>Your allowance renews on {formatDay(usage.resetsOn)}.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {usage.features.map((f) => (
              <Meter key={f.feature} f={f} resetsOn={usage.resetsOn} />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>What counts</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>Each card counts as one scan, front and back together.</li>
            <li>Each question you send in Ask counts once.</li>
            <li>Voice notes count by the minute, rounded up.</li>
            <li>
              Meeting briefs, follow-up drafts and rewriting the Insights summary each count once. Opening a brief that&apos;s
              still up to date is free.
            </li>
            <li>Searching, filters, the graph and the Insights charts never count.</li>
            <li>If something fails on our side, it doesn&apos;t count.</li>
          </ul>
        </CardContent>
      </Card>
    </>
  );
}
