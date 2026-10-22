# Security

MyNetwork stores other people's contact details, private notes, voice recordings and card photos. This document describes how that data is protected, what the protections don't cover, and how to operate the keys safely.

## Reporting a vulnerability

Please report security problems privately through GitHub's **Security → Report a vulnerability** on this repository, not in a public issue. Include steps to reproduce and what you think the impact is. Please don't access other people's data or run load tests against the live service.

## Threat model

**Protected against**

| Threat | Protection |
|---|---|
| A leaked database dump or backup | Sensitive fields and all files are encrypted with per-user keys. Those keys are stored only in wrapped form, and the master key that unwraps them is not in the database. |
| Someone browsing the Supabase dashboard or storage bucket | They see the same ciphertext as above. |
| One user reading or changing another user's data | Row-level security on every table, owner-only storage policies, and server code that uses the signed-in user's own database session. |
| Ciphertext copied between rows or users | Each value is bound to its user, table, column and row id (AES-GCM additional data), so a moved value fails to decrypt. |
| Password guessing, credential stuffing and bots | Captcha (Turnstile), per-account and per-network rate limits, a 12-character minimum, breached-password checks, and optional two-step sign-in. |
| A stolen but unlocked session making high-impact changes | Downloading data, deleting the account, and changing the password or authenticators all require the password (and authenticator code, if enrolled) within the last 5 minutes. |
| Cross-site scripting, clickjacking and framing | Per-request nonce Content Security Policy, `frame-ancestors 'none'`, and the other headers listed below. |

**Not protected against**

- **A compromise of the server environment.** The master key lives in the Vercel environment variables. Anyone who can read those and the database can decrypt everything. The same applies to the people who operate the service.
- **A compromised device or browser** of a signed-in user.
- **Plaintext columns.** Names, native-script names, job titles, companies, websites, cities, countries, role/seniority/industry tags, event names and dates are stored without field encryption, so search, filters and the graph work. They're protected only by Supabase's disk encryption and row-level security.
- **Embeddings.** Search vectors are computed from contact, note and event text and are not encrypted with the user's key. They reveal something about the topics of the text, though not the text itself.
- **Metadata.** Row counts, timestamps and which rows relate to which.
- **AI providers.** Requests are processed in plaintext by the model provider. We rely on OpenRouter's zero-data-retention routing and the providers' commitments not to store or train on them.

## Encryption

### Keys

| Secret | Where | Used for |
|---|---|---|
| `APP_MASTER_KEY` (32 bytes, base64) | Server environment only | Wraps each user's data key (AES-256-GCM). |
| Per-user data key (32 bytes) | `user_keys.wrapped_dek`, wrapped by the master key; no client access | Encrypts that user's fields and files. |
| `APP_BLIND_INDEX_KEY` (32 bytes, base64) | Server environment only | Keyed hashes (HMAC-SHA256), with a separate derived key for each purpose. |

- Each wrapped key is bound to its user and master key version: the additional data is `user_keys|<user id>|v<version>`.
- A data key is created on first use and unwrapped at most once per request, on the server. It is never sent to the browser.
- Field values use AES-256-GCM with a random 12-byte IV. The additional data is `<user id>|<table>|<column>|<row id>`.
- Files are encrypted the same way, bound to their storage path, and stored in the private `vault` bucket under `<user id>/`. Card photos are re-encoded first, which drops EXIF and GPS metadata.

### What's encrypted

| Encrypted with the user's key | Stored as plaintext |
|---|---|
| Email addresses, phone numbers, street addresses | Names, job titles, companies, websites |
| Raw card readings, QR codes | Cities, countries, role, seniority and industry tags |
| Notes, voice note transcripts and summaries | Event names, dates and locations |
| Card photos, thumbnails, voice recordings | Follow-up due dates, interaction dates and types |
| Event descriptions, follow-up notes | Search embeddings |
| Ask chats and titles, search chunks | Usage counters, AI cost records |
| AI suggestions, meeting briefs, Insights summaries | |

Email addresses and phone numbers also have blind indexes (HMAC of the normalized value), which are used for duplicate detection without decrypting. IP addresses are stored only as keyed hashes.

### Rotating the master key

Older versions stay readable through `APP_MASTER_KEY_V<n>` while you rotate:

1. Generate a new key: `openssl rand -base64 32`.
2. Set `APP_MASTER_KEY_V<current version>` to the current key. Then set `APP_MASTER_KEY` to the new key and increase `APP_MASTER_KEY_VERSION` by one.
3. Deploy. New data keys use the new version, and existing ones still open.
4. With the same values in `.env.local`, run `pnpm rotate:master-key` to see how many keys are on old versions. Then run `pnpm rotate:master-key --apply` to re-wrap them.
5. When no keys are left on the old version, remove `APP_MASTER_KEY_V<old version>` and redeploy.

Only the small wrapped keys change; encrypted contacts, notes and files are not rewritten. The blind index key can't be rotated without recomputing every hash, so treat it as permanent.

### Backups of the keys

**Losing `APP_MASTER_KEY` means losing every user's encrypted data.** Keep the production master key and blind index key in a password manager or other offline store, separate from database backups.

## Access control

- **Row-level security** is enabled on every table. Policies allow users only their own rows.
- **Links stay within one account.** Foreign keys match on the owner as well as the id, so a note, interaction, reminder or any other row can only point at a contact, event, company, note or chat of the same user. This holds for the service role too, so following a link never crosses accounts.
- **Two-step sign-in in the database.** When a user has an authenticator, restrictive policies (`mfa_satisfied()`) also require an `aal2` session. A session that skipped the second step can't read data even through the database API directly.
- **Server-only tables and functions.** The browser has no access at all to `user_keys`. Users can read their own `audit_log`, `ai_usage`, `entitlements` and `usage_counters` rows, but only the server can write them. Quota, reconnect and similarity functions are revoked from client roles.
- **The service-role client** (`lib/supabase/admin.ts`) is used only for keys, the audit log, metering, scheduled jobs, background card reading and indexing (always filtered by the owner's id), and account deletion.
- **Tests:** `pnpm test:db` checks that users can't see, change or link to each other's rows and that client roles can't reach server-only tables and functions. It runs against the linked database inside transactions that are rolled back.

## Authentication

- **Server-side sign-in.** Sign-up, sign-in and password reset run as server actions. Each one is rate-limited, audited and protected by captcha; Supabase also enforces the captcha on its own auth API.
- **Passwords** need at least 12 characters. New passwords are checked against Have I Been Pwned using only the first 5 characters of the password's SHA-1 hash.
- **Two-step sign-in** (TOTP) is optional. Once enrolled, it's enforced in `proxy.ts`, in `requireUser()` and in the database. Supabase doesn't offer recovery codes, so the app encourages adding a second authenticator. If someone is locked out, verify who they are another way first. Then remove their factor in the Supabase dashboard (**Authentication → Users → user → Multi-factor**).
- **Confirming it's you.** This uses a signed, `httpOnly`, `SameSite=Strict` cookie that expires after 5 minutes. The password is checked on a separate client, so the current session isn't changed.
- **Sessions** are Supabase cookies, refreshed in `proxy.ts`. Pages verify the token's signature with `getClaims()` and never trust unverified cookie contents.
- **Audit log.** It records sign-ins (including failures), two-step changes, password changes, data downloads, contact deletions and merges. When an account is deleted, its own log goes with it. Only a record that the account was deleted remains, with no email or other details.

## Web and API hardening

- **Headers:**
  - Content Security Policy with a per-request nonce and `strict-dynamic`
  - HSTS with preload
  - `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Permissions-Policy`: camera and microphone for this site only, everything else off
- **Requests.** Server actions and the sign-out endpoint accept same-origin requests only. Every input is validated with zod.
- **Uploads** are checked by their actual bytes, not the declared type, and size-capped. Images are re-encoded with `sharp`, and audio must be AAC/MP4 or Ogg.
- **Service worker.** It caches only the content-hashed build files, the icons and a static offline page, never pages, API responses or user data.

## AI

- All model calls go through OpenRouter with `provider.zdr = true` and `data_collection: "deny"` on every request. Turn on the account-level zero-data-retention setting as a second, independent guard.
- Each feature sends only the context it needs (see the privacy policy). Card text, notes and retrieved snippets are passed as quoted data, not instructions.
- The test-only AI modes (`AI_MODE=record` and `mock`, which save and replay responses) are refused when running on Vercel.
- The tools available to Ask are read-only. AI output never sends messages or changes data without the user accepting it.
- **Spend limits:**
  - per-user rate limits
  - monthly allowances per plan (`plans`, `consume_quota`)
  - a global daily spend cap that pauses AI features and fails closed if it can't be checked (`AI_GLOBAL_DAILY_USD`)
  - a credit limit on the OpenRouter key itself

## Account deletion

**Settings → Your data → Delete account** requires confirming it's you and typing `delete`. It then:

1. removes every file under the user's storage folder;
2. deletes the auth user, and with it, through cascading foreign keys, every row the user owns, including their wrapped data key;
3. records an anonymous `account.deleted` entry and signs the user out.

AI usage records are kept without the user id, for cost accounting. Database backups still hold encrypted copies until they expire, within 30 days, so a backup restore must not be used to bring back deleted accounts.

## Secrets in the repository

The repository is public. `.env*` files other than `.env.example` are ignored. `pnpm secrets:check` (installed as a pre-commit hook by `pnpm hooks:install`) blocks commits that contain anything that looks like a key or token. Test fixtures use made-up people and generated card images only.
