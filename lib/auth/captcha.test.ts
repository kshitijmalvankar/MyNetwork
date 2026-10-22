import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCaptcha } from "@/lib/auth/captcha";

const TEST_SECRET = "1x0000000000000000000000000000000AA";
const REAL_SECRET = "0x4AAAAAAAreal-looking-secret";

function cloudflareSays(body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("verifyCaptcha", () => {
  it("asks the user to wait when there's no token yet, without calling Cloudflare", async () => {
    const fetch = cloudflareSays({ success: true });
    expect(await verifyCaptcha("")).toBe("missing");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the token, secret and address to Cloudflare and accepts a pass", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", TEST_SECRET);
    const fetch = cloudflareSays({ success: true });
    expect(await verifyCaptcha("token-123", "203.0.113.7")).toBe("ok");
    const body = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(Object.fromEntries(body)).toEqual({ secret: TEST_SECRET, response: "token-123", remoteip: "203.0.113.7" });
  });

  it("rejects what Cloudflare rejects", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", REAL_SECRET);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    cloudflareSays({ success: false, "error-codes": ["timeout-or-duplicate"] });
    expect(await verifyCaptcha("used-token")).toBe("failed");
  });

  it("fails closed when Cloudflare can't be reached", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", REAL_SECRET);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect(await verifyCaptcha("token")).toBe("failed");
  });

  it("fails closed when no secret is set", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = cloudflareSays({ success: true });
    expect(await verifyCaptcha("token")).toBe("failed");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses Cloudflare's test secrets in production, but allows them in previews and locally", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = cloudflareSays({ success: true });
    vi.stubEnv("TURNSTILE_SECRET_KEY", TEST_SECRET);

    vi.stubEnv("VERCEL_ENV", "production");
    expect(await verifyCaptcha("token")).toBe("failed");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "2x0000000000000000000000000000000AA");
    expect(await verifyCaptcha("token")).toBe("failed");
    expect(fetch).not.toHaveBeenCalled();

    vi.stubEnv("TURNSTILE_SECRET_KEY", TEST_SECRET);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await verifyCaptcha("token")).toBe("ok");
    vi.stubEnv("VERCEL_ENV", "");
    expect(await verifyCaptcha("token")).toBe("ok");
  });

  it("accepts the real secret in production", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", REAL_SECRET);
    cloudflareSays({ success: true });
    expect(await verifyCaptcha("token")).toBe("ok");
  });
});
