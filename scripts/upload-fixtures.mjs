// Uploads the synthetic fixture cards through the real API as the local test
// account, to exercise (or demo) the scan → review flow:
//   pnpm dev:upload-fixtures [card-id ...]
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

process.loadEnvFile?.(".env.local");
const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Sign in and capture the session cookies the app expects.
const jar = new Map();
const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
  },
});
const { error } = await supabase.auth.signInWithPassword({
  email: process.env.E2E_TEST_EMAIL,
  password: process.env.E2E_TEST_PASSWORD,
});
if (error) {
  console.error("Sign-in failed (run `pnpm seed:dev` first):", error.message);
  process.exit(1);
}
const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");

const fixtures = JSON.parse(readFileSync("fixtures/cards/expected.json", "utf8"));
const only = process.argv.slice(2);
const batchId = crypto.randomUUID();

for (const f of fixtures.filter((f) => only.length === 0 || only.includes(f.id))) {
  const body = new FormData();
  const type = (p) => (p.endsWith(".jpg") ? "image/jpeg" : "image/png");
  body.set("front", new Blob([readFileSync(`fixtures/cards/${f.front}`)], { type: type(f.front) }), f.front);
  if (f.back) body.set("back", new Blob([readFileSync(`fixtures/cards/${f.back}`)], { type: type(f.back) }), f.back);
  body.set("batchId", batchId);
  const started = Date.now();
  const res = await fetch(`${base}/api/scans`, { method: "POST", body, headers: { cookie, origin: base } });
  console.log(`${f.id.padEnd(22)} ${res.status} ${Date.now() - started}ms`, await res.text());
}
