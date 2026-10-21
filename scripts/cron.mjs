// Runs a scheduled job against the local dev server: pnpm cron <job>
process.loadEnvFile?.(".env.local");
const job = process.argv[2];
if (!job) {
  console.error("Usage: pnpm cron <job>   (e.g. sweep-scans)");
  process.exit(1);
}
const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const res = await fetch(`${base}/api/cron/${job}`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
console.log(res.status, await res.text());
