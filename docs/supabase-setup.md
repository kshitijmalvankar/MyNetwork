# Supabase project settings

Database objects live in `supabase/migrations` (`pnpm db:push`). The settings
below are configured once in the Supabase dashboard for each project.

## Authentication → Sign In / Providers → Email
- **Confirm email:** on
- **Secure email change:** on
- **Minimum password length:** 12
- **Leaked password protection:** on, if your plan includes it (the app also checks new passwords itself)

## Authentication → URL Configuration
- **Site URL:** `http://localhost:3000` while developing; your production URL once deployed
- **Redirect URLs:** add `http://localhost:3000/**`, plus your production URL (for example `https://yourdomain.com/**`) once deployed

## Authentication → Emails → Templates
Links that work on any device (for example, signing up on a laptop and opening the email on a phone) use a token hash instead of the default PKCE link.
- **Confirm signup:** change the link to
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/home`
- **Reset password:** change the link to
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

## Authentication → Emails → SMTP Settings
Supabase's built-in email only sends to members of your Supabase organization, and only a few messages an hour. Before inviting anyone else, add a custom SMTP provider:
- for example, Resend: `smtp.resend.com`, port 465, username `resend`, and an API key as the password
- set the sender to an address on a domain you've verified

## Authentication → Attack Protection
- **Enable Captcha protection:** on, provider **Turnstile**
- **Secret:** the value of `TURNSTILE_SECRET_KEY`. Use the test secret locally and your real Cloudflare secret in production.

Captcha is enforced by Supabase itself, so it also protects the public auth API, not just the app's forms. The app forwards the widget token on sign-up, sign-in and password reset.

## Authentication → Multi-Factor
- **TOTP (App Authenticator):** enabled (the default)

## Test accounts
`pnpm seed:dev` creates the confirmed test account defined by `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in `.env.local`. `pnpm seed:dev --clean` removes every account on an `example.com/org/net` address.
