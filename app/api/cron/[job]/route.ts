import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { indexStale, refreshSimilarity } from "@/lib/knowledge/indexer";
import { refreshReconnects } from "@/lib/suggestions";
import { sweepScans } from "@/lib/scans/process";

export const maxDuration = 300;

function authorized(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${serverEnv.cronSecret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const jobs: Record<string, () => Promise<unknown>> = {
  "sweep-scans": () => sweepScans({ limit: 30 }),
  "index-stale": () => indexStale({ limit: 200 }),
  "suggest-reconnects": () => refreshReconnects(),
  // Nightly: a new or changed person can be someone else's closest match too.
  "refresh-similarity": () => refreshSimilarity({}),
};

/** Scheduled jobs (Vercel Cron in production, `pnpm cron <job>` locally). */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/cron/[job]">) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  const { job } = await params;
  const run = jobs[job];
  if (!run) return new NextResponse("Unknown job", { status: 404 });
  const result = await run();
  return NextResponse.json({ ok: true, job, result });
}
