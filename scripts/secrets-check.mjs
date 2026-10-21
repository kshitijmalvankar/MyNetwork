// Fails if staged changes contain anything that looks like a credential.
// Run before committing: `pnpm secrets:check` (also wired as a git pre-commit hook by `pnpm hooks:install`).
import { execSync } from "node:child_process";

const patterns = [
  [/sb_secret_[A-Za-z0-9_-]{10,}/, "Supabase secret key"],
  [/sb_publishable_[A-Za-z0-9_-]{10,}/, "Supabase publishable key (keep in env files)"],
  [/sk-or-v1-[A-Za-z0-9]{20,}/, "OpenRouter API key"],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, "JWT"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/^\+.*(APP_MASTER_KEY|APP_BLIND_INDEX_KEY|CRON_SECRET|SUPABASE_DB_PASSWORD|TURNSTILE_SECRET_KEY)=(?!1x0{4})[^\s]{8,}/m, "secret env value"],
];

const diff = execSync("git diff --cached -U0 --no-color -- . ':(exclude)pnpm-lock.yaml'", { encoding: "utf8" });
const added = diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));

const hits = [];
for (const line of added) {
  for (const [re, label] of patterns) if (re.test(line)) hits.push(`${label}: ${line.slice(0, 80)}…`);
}

if (hits.length) {
  console.error("Possible secrets in staged changes:\n" + hits.map((h) => `  • ${h}`).join("\n"));
  process.exit(1);
}
console.log("secrets:check passed");
