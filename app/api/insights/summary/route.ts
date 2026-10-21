import { NextResponse } from "next/server";
import { guardAiRequest, textError } from "@/lib/ai/guard";
import { MIN_PEOPLE_FOR_SUMMARY, statsHash, writeSummary, type InsightSummary, type NetworkStats } from "@/lib/ai/insights";
import { globalBudgetExceeded, recordUsage, releaseQuota } from "@/lib/ai/metering";
import { models } from "@/lib/ai/models";
import { getAuthorizedUser, getProfile, type SessionUser } from "@/lib/auth/dal";
import { openJson, sealJson } from "@/lib/crypto/envelope";
import { getUserDataKey } from "@/lib/crypto/user-key";
import { todayIn } from "@/lib/dates";
import { rateLimit } from "@/lib/ratelimit";
import { fromBytea, toBytea } from "@/lib/supabase/bytea";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

const WEEK_MS = 7 * 24 * 3600 * 1000;
const field = (userId: string) => ({ userId, table: "insight_summaries", column: "payload_enc", rowId: userId });

type Body = { summary: InsightSummary | null; createdAt?: string; stale?: boolean; reason?: "few" | "paused" };

async function context(user: SessionUser) {
  const supabase = await createClient();
  const profile = await getProfile(user.id);
  const { data, error } = await supabase.rpc("network_insights", { p_time_zone: profile?.timezone ?? "UTC" });
  if (error) throw new Error(error.message);
  const stats = data as unknown as NetworkStats;
  return { supabase, profile, stats, hash: statsHash(user.id, stats), today: todayIn(profile?.timezone) };
}

async function generate(user: SessionUser, ctx: Awaited<ReturnType<typeof context>>): Promise<Body> {
  const { summary, usage } = await writeSummary(ctx.stats, { name: ctx.profile?.display_name, today: ctx.today });
  await recordUsage(user.id, [usage]);
  const dek = await getUserDataKey(user.id);
  const createdAt = new Date().toISOString();
  const { error } = await ctx.supabase.from("insight_summaries").upsert({
    user_id: user.id,
    input_hash: ctx.hash,
    payload_enc: toBytea(sealJson(dek, summary, field(user.id))),
    model: models.chat,
    created_at: createdAt,
  });
  if (error) console.error("[insights] failed to cache summary", error.message);
  return { summary, createdAt, stale: false };
}

/** The weekly summary: cached for a week, written (free of charge) when there isn't a recent one. */
export async function GET() {
  const user = await getAuthorizedUser();
  if (!user) return textError(401, "Please sign in again.");
  const ctx = await context(user);
  if (ctx.stats.totals.people < MIN_PEOPLE_FOR_SUMMARY) return NextResponse.json({ summary: null, reason: "few" } satisfies Body);

  const { data: cached } = await ctx.supabase.from("insight_summaries").select("input_hash, payload_enc, created_at").maybeSingle();
  if (cached && Date.now() - new Date(cached.created_at).getTime() < WEEK_MS) {
    const dek = await getUserDataKey(user.id);
    const summary = openJson<InsightSummary>(dek, fromBytea(cached.payload_enc), field(user.id));
    return NextResponse.json({ summary, createdAt: cached.created_at, stale: cached.input_hash !== ctx.hash } satisfies Body);
  }

  if ((await globalBudgetExceeded()) || !(await rateLimit("assist", user.id)).success) {
    return NextResponse.json({ summary: null, reason: "paused" } satisfies Body);
  }
  try {
    return NextResponse.json(await generate(user, ctx));
  } catch (err) {
    console.error("[insights] summary failed", err instanceof Error ? err.message : err);
    return textError(502, "We couldn't write your summary just now.");
  }
}

/** Rewrite it now. Counts as one brief. */
export async function POST() {
  const user = await getAuthorizedUser();
  if (!user) return textError(401, "Please sign in again.");
  const ctx = await context(user);
  if (ctx.stats.totals.people < MIN_PEOPLE_FOR_SUMMARY) return NextResponse.json({ summary: null, reason: "few" } satisfies Body);
  const blocked = await guardAiRequest(user.id, "brief", "assist", "briefs and drafts");
  if (blocked) return blocked;
  try {
    return NextResponse.json(await generate(user, ctx));
  } catch (err) {
    await releaseQuota(user.id, "brief");
    console.error("[insights] summary failed", err instanceof Error ? err.message : err);
    return textError(502, "We couldn't write your summary just now.");
  }
}
