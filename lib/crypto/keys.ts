import "server-only";
import { createHash, hkdfSync } from "node:crypto";

const KEY_BYTES = 32;

function decodeKey(name: string, value: string | undefined): Buffer {
  if (!value) throw new Error(`${name} is not set`);
  const key = Buffer.from(value, "base64");
  if (key.length !== KEY_BYTES) throw new Error(`${name} must be ${KEY_BYTES} bytes (base64)`);
  return key;
}

export function currentMasterKeyVersion(): number {
  const v = Number(process.env.APP_MASTER_KEY_VERSION ?? "1");
  if (!Number.isInteger(v) || v < 1) throw new Error("APP_MASTER_KEY_VERSION must be a positive integer");
  return v;
}

/**
 * The master key for a given version. The current version reads
 * APP_MASTER_KEY; older versions stay readable during rotation via
 * APP_MASTER_KEY_V<n>.
 */
export function masterKey(version: number = currentMasterKeyVersion()): Buffer {
  if (version === currentMasterKeyVersion()) return decodeKey("APP_MASTER_KEY", process.env.APP_MASTER_KEY);
  return decodeKey(`APP_MASTER_KEY_V${version}`, process.env[`APP_MASTER_KEY_V${version}`]);
}

export function blindIndexKey(): Buffer {
  return decodeKey("APP_BLIND_INDEX_KEY", process.env.APP_BLIND_INDEX_KEY);
}

/** Purpose-bound sub-keys so one secret is never used for two jobs. */
export function deriveKey(root: Buffer, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", root, createHash("sha256").update("mynetwork").digest(), purpose, KEY_BYTES));
}
