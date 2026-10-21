import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  DecryptionError,
  decrypt,
  encrypt,
  generateDataKey,
  openField,
  openJson,
  sealField,
  sealJson,
  unwrapDataKey,
  wrapDataKey,
} from "@/lib/crypto/envelope";
import { blindIndex, hashIp, normalizeEmail } from "@/lib/crypto/blind-index";

const ctx = { userId: randomUUID(), table: "contacts", column: "emails_enc", rowId: randomUUID() };

describe("encrypt / decrypt", () => {
  it("round-trips text and bytes", () => {
    const key = generateDataKey();
    expect(decrypt(key, encrypt(key, "hello ✓", "a"), "a").toString("utf8")).toBe("hello ✓");
    const bytes = new Uint8Array([0, 1, 2, 255]);
    expect([...decrypt(key, encrypt(key, bytes, "b"), "b")]).toEqual([...bytes]);
  });

  it("uses a fresh IV every time", () => {
    const key = generateDataKey();
    expect(encrypt(key, "same", "a").equals(encrypt(key, "same", "a"))).toBe(false);
  });

  it("rejects the wrong key, wrong context, tampering and garbage", () => {
    const key = generateDataKey();
    const payload = encrypt(key, "secret", "ctx");
    expect(() => decrypt(generateDataKey(), payload, "ctx")).toThrow(DecryptionError);
    expect(() => decrypt(key, payload, "other")).toThrow(DecryptionError);
    const tampered = Buffer.from(payload);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decrypt(key, tampered, "ctx")).toThrow(DecryptionError);
    expect(() => decrypt(key, Buffer.from("short"), "ctx")).toThrow(DecryptionError);
  });
});

describe("data keys", () => {
  it("wraps and unwraps a user's key", () => {
    const dek = generateDataKey();
    const userId = randomUUID();
    expect(unwrapDataKey(wrapDataKey(dek, userId, 1), userId, 1).equals(dek)).toBe(true);
  });

  it("binds a wrapped key to its user", () => {
    const wrapped = wrapDataKey(generateDataKey(), randomUUID(), 1);
    expect(() => unwrapDataKey(wrapped, randomUUID(), 1)).toThrow(DecryptionError);
  });

  it("reads older master key versions during rotation", () => {
    const userId = randomUUID();
    const dek = generateDataKey();
    const wrappedV1 = wrapDataKey(dek, userId, 1);
    vi.stubEnv("APP_MASTER_KEY_V1", process.env.APP_MASTER_KEY!);
    vi.stubEnv("APP_MASTER_KEY", Buffer.alloc(32, 9).toString("base64"));
    vi.stubEnv("APP_MASTER_KEY_VERSION", "2");
    try {
      expect(unwrapDataKey(wrappedV1, userId, 1).equals(dek)).toBe(true);
      expect(unwrapDataKey(wrapDataKey(dek, userId, 2), userId, 2).equals(dek)).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("fields", () => {
  it("round-trips fields and JSON", () => {
    const dek = generateDataKey();
    expect(openField(dek, sealField(dek, "a@b.co", ctx), ctx).toString()).toBe("a@b.co");
    expect(openJson(dek, sealJson(dek, { emails: ["a@b.co"] }, ctx), ctx)).toEqual({ emails: ["a@b.co"] });
  });

  it("cannot be copied to another row, column or user", () => {
    const dek = generateDataKey();
    const sealed = sealField(dek, "a@b.co", ctx);
    expect(() => openField(dek, sealed, { ...ctx, rowId: randomUUID() })).toThrow(DecryptionError);
    expect(() => openField(dek, sealed, { ...ctx, column: "phones_enc" })).toThrow(DecryptionError);
    expect(() => openField(dek, sealed, { ...ctx, userId: randomUUID() })).toThrow(DecryptionError);
  });
});

describe("blind index", () => {
  it("is stable for the same user and value, and differs across users", () => {
    const user = randomUUID();
    const email = normalizeEmail("  Priya@Example.COM ");
    expect(email).toBe("priya@example.com");
    expect(blindIndex(user, "email", email)).toBe(blindIndex(user, "email", email));
    expect(blindIndex(user, "email", email)).not.toBe(blindIndex(randomUUID(), "email", email));
    expect(blindIndex(user, "email", email)).not.toBe(blindIndex(user, "phone", email));
  });

  it("hashes IPs without revealing them", () => {
    expect(hashIp("203.0.113.7")).toBe(hashIp("203.0.113.7"));
    expect(hashIp("203.0.113.7")).not.toContain("203");
  });
});
