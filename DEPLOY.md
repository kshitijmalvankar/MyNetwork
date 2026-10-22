# Deploying MyNetwork

MyNetwork runs on **Vercel** (the app) and **Supabase** (database, sign-in and files). The Supabase project you've been developing against is the production database, so deploying mostly means configuring the outside services and Vercel's environment variables.

Allow about an hour. Follow the steps in order.

## 1. What you need

| Service | Why | Notes |
|---|---|---|
| Vercel, **Pro plan** | Hosting | The scheduled jobs in `vercel.json` run more often than once a day, which needs Pro. |
| Supabase | Database, sign-in, files | Your existing project (region eu-west-1, Ireland). |
| OpenRouter | AI models | A separate key for production, with a credit limit. |
| Upstash Redis | Rate limits shared across servers | Free tier is enough. Create it in `eu-west-1`. |
| Cloudflare Turnstile | Bot protection on sign-in and sign-up | Free. |
| An email provider, e.g. Resend | Sign-up confirmation and password reset emails | Needs a domain you can add DNS records to. |
| A domain | For example `mynetwork.app` | Used by Vercel, Turnstile, the email provider and Supabase. |

## 2. Keys and secrets

The database already holds data encrypted with the keys in your `.env.local`. **Production must use the same `APP_MASTER_KEY`, `APP_MASTER_KEY_VERSION` and `APP_BLIND_INDEX_KEY`**, or that data can't be read.

1. Copy those three values into a password manager now. Losing the master key means losing every user's encrypted data, and nothing can recover it.
2. Generate a new `CRON_SECRET` for production: `openssl rand -base64 24`.

## 3. Supabase

Work through [docs/supabase-setup.md](docs/supabase-setup.md), with these production values:

- **Migrations:** run `pnpm db:push` so the database matches the code you're deploying.
- **SMTP:** add your email provider under Authentication → Emails → SMTP Settings, sending from your domain.
- **Confirm email:** turn it **on** once SMTP works.
- **URLs:** set the Site URL to `https://<your domain>` and add `https://<your domain>/**` to the redirect URLs.
- **Email templates:** use the confirmation and reset links described in that document.
- **Captcha:** turn it on with your **real** Turnstile secret (step 6).
- **Backups:** check how long your plan keeps database backups. The privacy policy promises that deleted accounts disappear from backups **within 30 days**, so the retention must not be longer. If you change it, update the policy too.
- **Test data:** remove the test accounts with `pnpm seed:dev --clean`. It only deletes accounts on `example.com/org/net` addresses.

## 4. OpenRouter

1. Open [Settings → Privacy](https://openrouter.ai/settings/privacy) and turn on **Zero Data Retention** for the account. The app also requests it on every call; the account setting is a second guard.
2. Create a new API key for production and give it a **credit limit** (for example $20 a month). This is the hard cap on AI spend.
3. Choose `AI_GLOBAL_DAILY_USD`. When total spend for the day passes this, AI features pause for everyone until the next day (default $5).

## 5. Upstash

Create a Redis database and copy its REST URL and token. Without them, rate limits only apply per server instance; the app logs a warning about it in production.

## 6. Turnstile

Create a widget for your domain (Managed mode). Put the **site key** in Vercel as `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and the **secret** in both Vercel (`TURNSTILE_SECRET_KEY`) and Supabase's captcha setting.

## 7. Vercel

1. Import the GitHub repository as a new project. The framework is detected as Next.js, and the default build settings are fine.
2. Under **Settings → General → Node.js Version**, choose **24.x**.
3. Add these environment variables for **Production**:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://<your domain>` |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | From Supabase → Project Settings → API Keys |
   | `SUPABASE_SECRET_KEY` | A secret key from the same page |
   | `APP_MASTER_KEY`, `APP_MASTER_KEY_VERSION`, `APP_BLIND_INDEX_KEY` | The values you saved in step 2 |
   | `CRON_SECRET` | The new value from step 2 |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | From step 6 |
   | `OPENROUTER_API_KEY` | The production key from step 4 |
   | `AI_GLOBAL_DAILY_USD` | For example `5` |
   | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | From step 5 |
   | `LEGAL_OPERATOR_NAME`, `LEGAL_CONTACT_EMAIL`, `LEGAL_GOVERNING_LAW` | Who runs the service, where to reach you, and whose law applies (for example `India`) |

   `SUPABASE_DB_PASSWORD` and `SUPABASE_DB_HOST` are only for running migrations from your machine; don't add them to Vercel.
4. **Preview deployments.** There's only one database, so a preview deployment with these variables would use real data. Either leave the **Preview** environment empty, so previews don't work, or turn on **Deployment Protection → Vercel Authentication** for previews before copying the variables there.
5. Deploy, then add your domain under **Settings → Domains**.

`vercel.json` already does two things:

- It runs the app in Dublin (`dub1`), next to the Supabase database.
- It schedules four background jobs. Vercel sends `CRON_SECRET` with each call, and requests without it are rejected.

| Job | When | What it does |
|---|---|---|
| `sweep-scans` | Every 10 minutes | Retries cards whose reading got stuck. |
| `index-stale` | Every 15 minutes | Updates search for anything that changed. |
| `suggest-reconnects` | Daily, 06:00 UTC | Suggests people it's been a while since you contacted. |
| `refresh-similarity` | Daily, 02:30 UTC | Recalculates "similar background" links in the graph. |

## 8. Legal pages

`/privacy` and `/terms` describe how this app actually handles data, but they're a starting point, not legal advice. Before launch:

- Set the three `LEGAL_*` variables. The pages say "Draft" until all three are set.
- Read both documents and have them reviewed for the countries you're launching in.
- Check that the hosting region and the list of service providers still match your setup.

## 9. Check the live site

- [ ] `curl -sI https://<your domain>` shows `content-security-policy`, `strict-transport-security` and `x-frame-options: DENY`.
- [ ] Sign up with a new email address. The confirmation email arrives, and its link works when opened on a phone.
- [ ] Turn on two-step sign-in in Settings → Security, sign out, and sign back in with a code.
- [ ] On a phone:
  - [ ] Scan a card with the camera, then review and save it.
  - [ ] Record a voice note on that contact.
  - [ ] Install the app (Safari: Share → Add to Home Screen; Chrome: Install app) and open it from the home screen.
- [ ] Ask a question, open a meeting brief, and open Insights.
- [ ] In OpenRouter's activity log, every request went to a zero-data-retention provider.
- [ ] In Vercel → **Cron Jobs**, run each job once. Each should return `200` in the logs.
- [ ] In the Supabase table editor, columns ending in `_enc` are unreadable bytes, and files in the `vault` bucket don't open as images.
- [ ] Settings → Your data: download the CSV, then delete the test account. You land on the sign-in page, and its files are gone from storage.

## Running it

- **Spend:** the OpenRouter dashboard shows daily cost. The `ai_usage` table has a breakdown by feature and model.
- **Raising allowances:** they live in the `plans` table. For example, in the Supabase SQL editor:

  ```sql
  update plans set limits = '{"scan": 100, "ask": 300, "voice_minutes": 60, "brief": 40}' where id = 'free';
  ```

  To give one person more, add a plan row and point their `entitlements.plan_id` at it.
- **Changing AI models:** set `CHAT_MODEL`, `VISION_MODEL` and the other model overrides. Check them first with `pnpm eval`. After changing `EMBEDDING_MODEL`, run `pnpm reindex`.
- **Locked out of two-step sign-in, rotating the master key:** see [SECURITY.md](SECURITY.md).

### If a secret leaks

1. Replace it at the source: Supabase secret key, OpenRouter key, Upstash token, Turnstile secret or `CRON_SECRET`.
2. Update the value in Vercel and redeploy.
3. If the master key may have leaked, rotate it as described in SECURITY.md. Treat the encrypted data as exposed if the database could also have been read.
4. To sign everyone out, run `delete from auth.sessions;` in the SQL editor. Sessions can't be renewed after that, but sign-ins already issued keep working until they expire, an hour by default.
5. Check the `audit_log` table for unusual sign-ins.
