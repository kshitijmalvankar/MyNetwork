// Thin wrapper around the Supabase CLI that builds the database URL from
// .env.local, so migrations work without Docker or a linked project.
//
//   pnpm db:push     apply pending migrations
//   pnpm db:types    regenerate lib/supabase/database.types.ts
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

process.loadEnvFile?.(".env.local");

const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0];
const host = process.env.SUPABASE_DB_HOST;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!ref || !host || !password) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_DB_HOST or SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}
const dbUrl = `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:5432/postgres`;

const command = process.argv[2];
const run = (args, opts = {}) => spawnSync("pnpm", ["exec", "supabase", ...args], { stdio: "inherit", ...opts });

if (command === "push") {
  process.exit(run(["db", "push", "--db-url", dbUrl, "--yes", ...process.argv.slice(3)]).status ?? 1);
} else if (command === "types") {
  const res = spawnSync("pnpm", ["exec", "supabase", "gen", "types", "--lang", "typescript", "--db-url", dbUrl, "--schema", "public"], {
    encoding: "utf8",
  });
  if (res.status !== 0) {
    process.stderr.write(res.stderr);
    process.exit(res.status ?? 1);
  }
  writeFileSync("lib/supabase/database.types.ts", res.stdout);
  console.log("Wrote lib/supabase/database.types.ts");
} else {
  console.error("Usage: node scripts/db.mjs <push|types>");
  process.exit(1);
}
