# Supabase project settings

Database objects live in `supabase/migrations` (`pnpm db:push`). The settings
below are configured once in the Supabase dashboard for each project.

## Authentication → Sign In / Providers → Email
- **Confirm email:** currently **off**, so anyone can sign up without a working email provider. Turn it back **on** once custom SMTP (below) is set up, before a public launch. Until then:
  - email addresses aren't verified
  - "Forgot password" emails only reach members of your Supabase organization
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
- **Enable Captcha protection:** **off**.

The app checks the Turnstile token itself, on the server, with the secret for its environment: Cloudflare's test secret locally and in the end-to-end tests, and the real one on Vercel. A Supabase project holds only one captcha secret, so if Supabase did the check, either local sign-in or production would break. Tokens can only be checked once, so turning Supabase's check on as well would make every sign-in fail.

## Authentication → Rate Limits
Keep the defaults, including 30 sign-ups and sign-ins per 5 minutes per IP address, and 30 emails an hour once custom SMTP is set up.

Requests that go through the app reach Supabase from Vercel's servers, so these per-address limits are shared by everyone using the app. Setting them much lower would turn away real users. They mainly limit people who call Supabase's auth API directly, which skips the app's captcha.

## Authentication → Multi-Factor
- **TOTP (App Authenticator):** enabled (the default)

## Test accounts
`pnpm seed:dev` creates the confirmed test account defined by `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in `.env.local`. `pnpm seed:dev --clean` removes every account on an `example.com/org/net` address.
