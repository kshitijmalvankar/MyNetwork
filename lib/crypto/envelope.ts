import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { masterKey } from "@/lib/crypto/keys";

// Ciphertext layout: [format (1)] [iv (12)] [auth tag (16)] [ciphertext]
const FORMAT = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = 1 + IV_BYTES + TAG_BYTES;

export class DecryptionError extends Error {
  constructor() {
    super("Unable to decrypt value");
    this.name = "DecryptionError";
  }
}

/** AES-256-GCM with additional authenticated data binding the value to its context. */
export function encrypt(key: Buffer, plaintext: Uint8Array | string, aad: string): Buffer {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const data = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([Buffer.from([FORMAT]), iv, cipher.getAuthTag(), ciphertext]);
}

export function decrypt(key: Buffer, payload: Uint8Array, aad: string): Buffer {
  const buf = Buffer.from(payload);
  if (buf.length < HEADER_BYTES || buf[0] !== FORMAT) throw new DecryptionError();
  const iv = buf.subarray(1, 1 + IV_BYTES);
  const tag = buf.subarray(1 + IV_BYTES, HEADER_BYTES);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(buf.subarray(HEADER_BYTES)), decipher.final()]);
  } catch {
    throw new DecryptionError();
  }
}

export function generateDataKey(): Buffer {
  return randomBytes(32);
}

const dekAad = (userId: string, version: number) => `user_keys|${userId}|v${version}`;

export function wrapDataKey(dek: Buffer, userId: string, version: number): Buffer {
  return encrypt(masterKey(version), dek, dekAad(userId, version));
}

export function unwrapDataKey(wrapped: Uint8Array, userId: string, version: number): Buffer {
  return decrypt(masterKey(version), wrapped, dekAad(userId, version));
}

export type FieldContext = { userId: string; table: string; column: string; rowId: string };

const fieldAad = ({ userId, table, column, rowId }: FieldContext) => `${userId}|${table}|${column}|${rowId}`;

export function sealField(dek: Buffer, value: Uint8Array | string, ctx: FieldContext): Buffer {
  return encrypt(dek, value, fieldAad(ctx));
}

export function openField(dek: Buffer, payload: Uint8Array, ctx: FieldContext): Buffer {
  return decrypt(dek, payload, fieldAad(ctx));
}

export function sealJson(dek: Buffer, value: unknown, ctx: FieldContext): Buffer {
  return sealField(dek, JSON.stringify(value), ctx);
}

export function openJson<T>(dek: Buffer, payload: Uint8Array, ctx: FieldContext): T {
  return JSON.parse(openField(dek, payload, ctx).toString("utf8")) as T;
}
