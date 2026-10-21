// Creates .env.local from .env.example (if missing) and fills any empty
// generated secrets. Existing values are never overwritten.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const target = ".env.local";
const generated = {
  APP_MASTER_KEY: () => randomBytes(32).toString("base64"),
  APP_BLIND_INDEX_KEY: () => randomBytes(32).toString("base64"),
  CRON_SECRET: () => randomBytes(24).toString("base64url"),
};

const source = existsSync(target) ? readFileSync(target, "utf8") : readFileSync(".env.example", "utf8");
const filled = [];

const output = source
  .split("\n")
  .map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return line;
    const [, key, value] = match;
    if (value.trim() === "" && generated[key]) {
      filled.push(key);
      return `${key}=${generated[key]()}`;
    }
    return line;
  })
  .join("\n");

writeFileSync(target, output, { mode: 0o600 });

const missing = output
  .split("\n")
  .map((l) => l.match(/^([A-Z0-9_]+)=$/)?.[1])
  .filter(Boolean);

console.log(`${target} ready.${filled.length ? ` Generated: ${filled.join(", ")}.` : ""}`);
if (missing.length) console.log(`Still empty: ${missing.join(", ")}`);
