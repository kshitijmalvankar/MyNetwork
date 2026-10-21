import "server-only";
import { adminClient } from "@/lib/supabase/admin";

export type Feature = "scan" | "ask" | "voice_minutes" | "brief" | "index";

export type UsageEntry = {
  feature: Feature;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
  escalated?: boolean;
  ok?: boolean;
};

export async function recordUsage(userId: string | null, entries: UsageEntry[]) {
  if (entries.length === 0) return;
  const { error } = await adminClient()
    .from("ai_usage")
    .insert(
      entries.map((e) => ({
        user_id: userId,
        feature: e.feature,
        model: e.model,
        input_tokens: e.inputTokens,
        output_tokens: e.outputTokens,
        cost_usd: e.costUsd,
        latency_ms: e.latencyMs,
        escalated: e.escalated ?? false,
        ok: e.ok ?? true,
      })),
    );
  if (error) console.error("[metering] failed to record usage", error.message);
}

export type QuotaResult = { allowed: boolean; used: number; quota: number };

/** Take from this month's allowance. Atomic, so concurrent uploads can't overshoot. */
export async function consumeQuota(userId: string, feature: Feature, amount = 1): Promise<QuotaResult> {
  const { data, error } = await adminClient().rpc("consume_quota", {
    p_user_id: userId,
    p_feature: feature,
    p_amount: amount,
  });
  if (error) throw error;
  const row = data?.[0];
  return { allowed: Boolean(row?.allowed), used: row?.used ?? 0, quota: row?.quota ?? 0 };
}

export async function releaseQuota(userId: string, feature: Feature, amount = 1) {
  const { error } = await adminClient().rpc("release_quota", { p_user_id: userId, p_feature: feature, p_amount: amount });
  if (error) console.error("[metering] failed to release quota", error.message);
}

export async function quotaStatus(userId: string, feature: Feature): Promise<{ used: number; quota: number }> {
  const db = adminClient();
  const period = new Date();
  const monthStart = `${period.getUTCFullYear()}-${String(period.getUTCMonth() + 1).padStart(2, "0")}-01`;
  const [{ data: counter }, { data: ent }] = await Promise.all([
    db.from("usage_counters").select("count").eq("user_id", userId).eq("feature", feature).eq("period", monthStart).maybeSingle(),
    db.from("entitlements").select("plans(limits)").eq("user_id", userId).maybeSingle(),
  ]);
  const limits = (ent?.plans as { limits?: Record<string, number> } | null)?.limits ?? {};
  return { used: counter?.count ?? 0, quota: Number(limits[feature] ?? 0) };
}

/** Pauses AI for everyone once today's total spend crosses AI_GLOBAL_DAILY_USD. Fails closed. */
export async function globalBudgetExceeded(): Promise<boolean> {
  const cap = Number(process.env.AI_GLOBAL_DAILY_USD ?? "5");
  if (!Number.isFinite(cap) || cap <= 0) return false;
  const { data, error } = await adminClient().rpc("ai_spend_today");
  if (error) {
    console.error("[metering] budget check failed", error.message);
    return true;
  }
  return Number(data ?? 0) >= cap;
}
