import "server-only";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateRule = { limit: number; window: Duration };
export type RateResult = { success: boolean; remaining: number; reset: number };

/** Named rules, so limits are tuned in one place. */
export const rules = {
  login: { limit: 8, window: "5 m" },
  loginIp: { limit: 40, window: "1 h" },
  signup: { limit: 5, window: "1 h" },
  passwordReset: { limit: 3, window: "1 h" },
  mfa: { limit: 6, window: "5 m" },
  stepUp: { limit: 6, window: "10 m" },
  upload: { limit: 60, window: "10 m" },
  review: { limit: 120, window: "10 m" },
  export: { limit: 10, window: "1 h" },
  edit: { limit: 200, window: "10 m" },
  // Per user; the monthly plan quota is the real cap on questions.
  ask: { limit: 20, window: "5 m" },
} satisfies Record<string, RateRule>;

export type RuleName = keyof typeof rules;

const useUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

if (!useUpstash && process.env.VERCEL_ENV === "production") {
  console.warn("[ratelimit] Upstash is not configured; falling back to per-instance in-memory limits.");
}

const upstash = new Map<RuleName, Ratelimit>();

function upstashLimiter(name: RuleName) {
  let limiter = upstash.get(name);
  if (!limiter) {
    const rule = rules[name];
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(rule.limit, rule.window),
      prefix: `rl:${name}`,
      analytics: false,
    });
    upstash.set(name, limiter);
  }
  return limiter;
}

const UNIT_MS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

export function durationMs(window: Duration): number {
  const match = /^(\d+)\s?(ms|s|m|h|d)$/.exec(window);
  if (!match) throw new Error(`Unsupported duration: ${window}`);
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}

/** Sliding-window limiter for local development and tests. */
export class MemoryLimiter {
  private hits = new Map<string, number[]>();

  limit(key: string, rule: RateRule, now = Date.now()): RateResult {
    const windowMs = durationMs(rule.window);
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    const success = recent.length < rule.limit;
    if (success) recent.push(now);
    this.hits.set(key, recent);
    return { success, remaining: Math.max(0, rule.limit - recent.length), reset: (recent[0] ?? now) + windowMs };
  }
}

const memory = new MemoryLimiter();

export async function rateLimit(name: RuleName, key: string): Promise<RateResult> {
  if (useUpstash) {
    const res = await upstashLimiter(name).limit(key);
    return { success: res.success, remaining: res.remaining, reset: res.reset };
  }
  return memory.limit(`${name}:${key}`, rules[name]);
}
