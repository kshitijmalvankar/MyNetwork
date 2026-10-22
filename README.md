# MyNetwork

A private place for everyone you meet at networking events. Scan business cards on your phone or desktop, keep notes and voice notes about people, and ask your network questions in plain English: "Who did I meet from Acme?" "Which engineers mentioned hiring?"

## Features

- **Card scanning:** one card at a time or in bulk, double-sided, in any language. An AI model reads each card, QR codes are decoded in the browser, and you review the result before it's saved.
- **Contacts:** grouped by company, role, industry, seniority and location. Each contact has a timeline of meetings, notes, voice notes and follow-ups.
- **Ask:** a chat that searches your contacts and notes and links to the people in its answers. Chats are saved, encrypted.
- **Meeting briefs and follow-up drafts** for any contact. Drafts are never sent for you.
- **Voice notes,** transcribed and summarized, with suggested follow-ups.
- **Graph:** a map of your network by company, event and similar background.
- **Insights:** charts of who you know and how you're keeping in touch, with a short written summary.
- **Security:**
  - Contact details, notes, recordings, photos and chats are encrypted with a key per user.
  - Optional two-step sign-in.
  - Your password is asked for again before sensitive actions.
  - Full CSV export, and account deletion that removes everything.
- **Installable** on phones and desktops as an app.

See [SECURITY.md](SECURITY.md) for how data is protected, and [DEPLOY.md](DEPLOY.md) to put it online.

## Stack

| Part | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19, TypeScript |
| Design | Tailwind CSS v4, shadcn/ui, Recharts, force-graph |
| Database, sign-in, files | Supabase: Postgres with pgvector, Auth, Storage |
| AI | AI SDK with OpenRouter, limited to zero-data-retention providers |
| Rate limits | Upstash Redis, or in memory when developing |

## Running it locally

You need Node 24 and pnpm 10, plus a Supabase project, an OpenRouter API key, and a Postgres connection for migrations.

```bash
pnpm install
pnpm setup:env
```

`pnpm setup:env` creates `.env.local` and generates the encryption keys and cron secret. Fill in the Supabase and OpenRouter values; `.env.example` explains each one. Then set up the database and start the app:

```bash
pnpm db:push
pnpm dev
```

The app runs at http://localhost:3000. Configure Supabase's auth settings once, as described in [docs/supabase-setup.md](docs/supabase-setup.md).

To try it with sample data, create the test account defined by `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in `.env.local`, then load a fictional network of 32 people:

```bash
pnpm seed:dev
pnpm seed:network
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the development server |
| `pnpm build`, `pnpm start` | Production build and server |
| `pnpm typecheck`, `pnpm lint` | Type and lint checks |
| `pnpm test` | Unit tests |
| `pnpm test:db` | Database security tests: each user sees only their own data. Changes are rolled back. |
| `pnpm test:e2e` | End-to-end tests in a real browser, with recorded AI responses (free) |
| `pnpm test:e2e:record` | Same, with real AI models, saving their responses for replay; costs under a cent |
| `pnpm eval [extract\|ask\|brief\|voice\|insights]` | Live AI quality checks on fictional data; costs a few cents. Results are in [evals/results/summary.md](evals/results/summary.md). |
| `pnpm db:push`, `pnpm db:types` | Apply migrations; regenerate database types |
| `pnpm seed:dev [--clean]` | Create or remove test accounts on `example.com` addresses |
| `pnpm seed:network` | Load the fictional network into the test account |
| `pnpm cron <job>` | Run a scheduled job against the local server |
| `pnpm reindex` | Rebuild search after changing the embedding model |
| `pnpm rotate:master-key [--apply]` | Re-wrap user keys after rotating the master key |
| `pnpm icons` | Regenerate the favicon and app icons |
| `pnpm secrets:check` | Block commits that contain keys |
| `pnpm hooks:install` | Install git hooks on this machine: `secrets:check` before every commit, and the unit and end-to-end tests before every push |

## End-to-end tests

`pnpm test:e2e` builds the app, starts it on port 3200 and drives it in Chromium through the main flows:
- signing in
- scanning and reviewing a card
- contacts, notes and follow-ups
- Ask, meeting briefs and drafts
- voice notes
- Insights and the graph
- the public pages
- downloading data and deleting the account

The main flows run at desktop size; the ones tagged `@phone` run again at phone size.

Each run creates a temporary `@example.com` account in your Supabase project and loads the fictional network into it, with its dates moved so it always looks the same age. At the end, the account is deleted through the app, and a cleanup step removes it if a run stops early. Install the browser once with `pnpm exec playwright install chromium`.

AI calls aren't made. They're replayed from `fixtures/ai`, so runs are free and give the same answers every time. Search uses local word-hashing embeddings instead of a real model.
- **When a test fails with "No recorded AI response"**, a prompt, tool or AI-dependent flow has changed. The request it couldn't match is saved in `test-results/ai-misses`.
- **To refresh the recordings**, delete `fixtures/ai` and run `pnpm test:e2e:record`, which uses the real models (under a cent per run). Commit the new files.

Add `E2E_SKIP_BUILD=1` to reuse the last build. `pnpm exec playwright show-report` opens the results, with traces of any failures.

## Project layout

```
app/              pages, server actions and API routes
  (app)/          signed-in pages: home, scan, review, contacts, ask, graph, events, insights, settings
  (auth)/         sign-in, sign-up, two-step and password reset
  (public)/       privacy policy and terms
components/       UI, grouped by feature; components/ui holds the shadcn primitives
lib/              server logic: crypto, AI, search indexing, contacts, auth, rate limits
supabase/         SQL migrations
e2e/              end-to-end tests (Playwright)
evals/            AI quality checks and their results
fixtures/         fictional cards, voice notes and network for tests and evals; recorded AI responses in fixtures/ai
scripts/          setup, seeding, key rotation and other maintenance
```
