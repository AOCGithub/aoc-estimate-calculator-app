# Access requests — Supabase Free

Prepared locally only. No deployment, production gate enablement, or live access changes were made.

The current local mode is [temporary save-and-continue entry](TEMPORARY-INTAKE-ACCESS.md): `npm run dev:access` saves the five details, then opens the calculator without verification or approval. Records remain pending. `npm run dev:access:review` restores [manual review and private invitations](MANUAL-ACCESS-TRIAL.md); `npm run dev:access:previous` restores the earlier provisional allowlist.

## Review submissions

1. Open the [Vercel Supabase resource](https://vercel.com/d/dashboard/integrations/supabase/icfg_Cist6CLoXI4pmUiXUN1y7OPV/resources/store_hR6ofB7412rKHA0P).
2. Choose **Open in Supabase**, then **Table Editor → public → access_requests**.
3. Review the name, company, website, role and business email. New requests have `review_status = pending`. You may mark reviewed entries `reviewed`.

In the manual trial, AOC uses `approved` or `declined` and creates a private access link for approved requests. Status alone does not grant a session. In the previous mode, approval remains the separate server-side `AOC_APPROVED_EMAILS` list. That old local/test allowlist does **not** verify email ownership; knowing an approved address is sufficient. Do not treat it as completed client authentication.

## Local use

With the repository linked to the Vercel project and Vercel CLI authenticated:

```powershell
npm run dev:access
```

Open http://localhost:5173. Stop any existing server on that port first. This command injects the database credentials into the local server without saving them in source files or changing Vercel settings. It writes requests to the connected Supabase database, not a separate local database.

Local-only `.env.development.local` must contain a random `AOC_ACCESS_SESSION_SECRET` of at least 32 characters. The older provisional mode also uses tester emails in `AOC_APPROVED_EMAILS`; temporary entry does not require an allowlist. Never commit these values. Normal production builds keep the access gate and request-storage flags off by default.

## Behavior and safety

- Every valid submission is saved as a new pending request; existing records are not overwritten. Temporary entry then opens the calculator without approval. This is not completed verification.
- In the preserved review mode, visitors see **Request received** and remain outside until invited. If saving fails in either mode, no success is claimed and their form entries remain editable.
- The local intake mode now saves [calculation snapshots in a linked estimates table](FORM-AND-ESTIMATE-RECORDS.md), alongside the access details. No reusable profiles, marketing information or uploaded files are stored. No Storage bucket is needed.
- RLS is enabled. Browser roles cannot read or write the table. The server can insert requests and read review decisions but cannot approve them. Keys are server-side, never `VITE_*` values.
- The existing attempt limiter is process-local, not a complete distributed anti-spam system. Email ownership verification and public-release access controls remain separate work.
- Free-plan database limits and inactivity pausing still apply. No paid Supabase plan was enabled.

## Database setup and checks

The private table was created in the connected project using the migration in `supabase/migrations/`. Existing tables are not dropped or replaced. This repository's setup script applies SQL directly; it does not register a Supabase CLI migration-history entry. Do not blindly run `supabase db push` against this already-prepared project.

```powershell
npx --yes vercel@65.7.0 env run -e production --scope aocs-projects-b933e3ab -- npm run access:db:check
npx --yes vercel@65.7.0 env run -e production --scope aocs-projects-b933e3ab -- npm run access:db:test
# With npm run dev:access:previous running (this tests the previous flow):
npx --yes vercel@65.7.0 env run -e production --scope aocs-projects-b933e3ab -- node tests/test-access-database-ui.mjs
npm test
```

The database test uses synthetic details and removes only its own test records. The server requires `SUPABASE_URL` and `SUPABASE_SECRET_KEY` (legacy `SUPABASE_SERVICE_ROLE_KEY` fallback). `AOC_ACCESS_REQUESTS_ENABLED=true` enables saving; the browser/server gate flags must also be enabled together. These flags have **not** been enabled on the live site.

## Earlier review/allowlist test results — 29 October 2026

Passed: real Supabase saving of all five fields, pending requests without calculator access, invalid/cross-origin rejection, private-table permissions, save-failure recovery, approved local sessions, reload/logout, unchanged calculation results, desktop (1440px), mobile (390px), and the full `npm test` regression suite. All synthetic database records were removed. No paid AI calls or production deployment were made for these checks.
