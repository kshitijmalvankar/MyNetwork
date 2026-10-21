import { describe, expect, it } from "vitest";
import { durationMs, MemoryLimiter } from "@/lib/ratelimit";
import { pwnedCount } from "@/lib/auth/pwned";

describe("MemoryLimiter", () => {
  it("allows up to the limit within the window, then blocks, then recovers", () => {
    const limiter = new MemoryLimiter();
    const rule = { limit: 2, window: "1 m" } as const;
    const t0 = 1_000_000;
    expect(limiter.limit("k", rule, t0).success).toBe(true);
    expect(limiter.limit("k", rule, t0 + 1).success).toBe(true);
    expect(limiter.limit("k", rule, t0 + 2).success).toBe(false);
    expect(limiter.limit("other", rule, t0 + 2).success).toBe(true);
    expect(limiter.limit("k", rule, t0 + 60_001).success).toBe(true);
  });

  it("parses durations", () => {
    expect(durationMs("5 m")).toBe(300_000);
    expect(durationMs("1h")).toBe(3_600_000);
  });
});

describe("pwnedCount", () => {
  // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
  const fakeFetch = (body: string, ok = true) =>
    (async () => new Response(body, { status: ok ? 200 : 503 })) as unknown as typeof fetch;

  it("finds a breached password by hash suffix", async () => {
    expect(await pwnedCount("password", fakeFetch("1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\nAAAA:0"))).toBe(9545824);
  });

  it("returns 0 when not found or the service is down", async () => {
    expect(await pwnedCount("password", fakeFetch("AAAA:3"))).toBe(0);
    expect(await pwnedCount("password", fakeFetch("", false))).toBe(0);
  });
});
