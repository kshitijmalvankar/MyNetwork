import "server-only";
import { consumeQuota, globalBudgetExceeded, type Feature } from "@/lib/ai/metering";
import { rateLimit, type RuleName } from "@/lib/ratelimit";

/** Plain-text error the browser can show as is. */
export const textError = (status: number, message: string) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

/**
 * Checks that run before every AI call: per-user rate limit, the global daily
 * budget, then this month's allowance (`amount` units are consumed here). Returns an
 * error response to send, or null to go ahead.
 */
export async function guardAiRequest(userId: string, feature: Feature, rule: RuleName, what: string, amount = 1): Promise<Response | null> {
  if (!(await rateLimit(rule, userId)).success) return textError(429, "That's a lot of requests at once. Please wait a minute and try again.");
  if (await globalBudgetExceeded()) return textError(503, "AI features are paused for today. Please try again tomorrow.");
  const quota = await consumeQuota(userId, feature, amount);
  if (!quota.allowed) {
    const left = Math.max(0, quota.quota - quota.used);
    return textError(429, left > 0 ? `That needs ${amount} ${what}, but you have ${left} left this month.` : `You've used all ${quota.quota} ${what} for this month.`);
  }
  return null;
}
