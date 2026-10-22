import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Feature } from "@/lib/ai/metering";
import type { Database } from "@/lib/supabase/database.types";

type Supabase = SupabaseClient<Database>;

/** The monthly allowances shown to users, in the order they're listed. */
export const METERED: { feature: Exclude<Feature, "index">; label: string; unit: string; noun: string }[] = [
  { feature: "scan", label: "Card scans", unit: "scans", noun: "card scans" },
  { feature: "ask", label: "Questions in Ask", unit: "questions", noun: "Ask questions" },
  { feature: "voice_minutes", label: "Voice note minutes", unit: "minutes", noun: "voice note minutes" },
  { feature: "brief", label: "Briefs, drafts and summaries", unit: "uses", noun: "briefs and drafts" },
];

/** At this share of an allowance, the app starts pointing it out. */
export const NEAR_LIMIT = 0.8;

export type FeatureUsage = (typeof METERED)[number] & { used: number; quota: number };
export type Usage = { plan: string; resetsOn: string; features: FeatureUsage[] };

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Allowances run per calendar month in UTC, the same as consume_quota(). */
export function usagePeriod(now = new Date()) {
  return {
    start: ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))),
    resetsOn: ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))),
  };
}

/** This month's usage against the user's plan, read with their own session. */
export async function getUsage(supabase: Supabase, userId: string): Promise<Usage> {
  const period = usagePeriod();
  const [{ data: ent }, { data: plans }, { data: counters }] = await Promise.all([
    supabase.from("entitlements").select("plan_id").eq("user_id", userId).maybeSingle(),
    supabase.from("plans").select("id, name, limits"),
    supabase.from("usage_counters").select("feature, count").eq("user_id", userId).eq("period", period.start),
  ]);
  const plan = plans?.find((p) => p.id === (ent?.plan_id ?? "free"));
  const limits = (plan?.limits ?? {}) as Record<string, number>;
  const used = new Map((counters ?? []).map((c) => [c.feature, c.count]));
  return {
    plan: plan?.name ?? "Free",
    resetsOn: period.resetsOn,
    features: METERED.map((m) => ({ ...m, used: used.get(m.feature) ?? 0, quota: Number(limits[m.feature] ?? 0) })),
  };
}

/** Allowances at or past the warning line, fullest first. */
export function nearLimit(usage: Usage) {
  return usage.features
    .filter((f) => f.quota > 0 && f.used / f.quota >= NEAR_LIMIT)
    .sort((a, b) => b.used / b.quota - a.used / a.quota);
}
