# Optional client profiles

Updated: 4 November 2026
Status: Production implementation, Supabase schema and Vercel settings prepared. Not deployed.

Implements Task #9: optional saving, an unchecked consent checkbox, confirmed reuse of relevant company facts, source records and protection for manual corrections. Verification/AOC approval remains paused.

## Client flow

1. Enter the five business details. **Remember my business details for next time** and **Save my details and estimates with AOC** start unchecked and are independent choices.
2. On return in the same browser, choose **Review saved details**, check them and choose **Use these details**. Existing entries are kept. Reuse does not select saving consent.
3. In **Apps and software** or **Documents and data**, open **Company profile**. Select known facts and check the separate consent box to save them.
4. Before reuse, select facts relevant to the current work and confirm they still apply. Current, fresh AI and deliberately cleared answers are protected. Reused fields are labelled **From confirmed profile** and invalidate an earlier calculation.
5. Updates require renewed consent and the current revision. Another tab's changes cannot be silently overwritten. Remove selected outdated facts or choose **Forget company profile** to delete the reusable profile immediately.

Only relevant company facts are reusable: apps, app metadata/access ownership, product/version/reference, known connection restrictions/import-export capabilities and information location. Prices, audit credits, ROI, complexity, staffing, action permissions, management and compatibility clearance are not copied. The existing-field whitelist is in [shared/client-profile.mjs](../shared/client-profile.mjs).

This is browser-owned reuse, not verified identity or an account/login system. Knowing an email cannot retrieve a profile. Clearing the private browser cookie loses that browser's access. Cross-device recovery and a client-facing estimate history are outside this feature.

## Storage and privacy

Production profiles use Supabase **Table Editor > public > client_profiles**. The table's details and facts columns contain only the opted-in information. Existing access_requests and estimates tables retain their separate purposes. Deleting a profile does not delete separately saved estimate records.

Only server credentials can read/write profiles; RLS is enabled with no browser policies or grants. Ownership comes from a random 256-bit HTTP-only browser credential; only its SHA-256 digest is stored. HTTPS uses a Secure, SameSite=Strict, host-only cookie. No profile token appears in a URL or browser JavaScript storage, and no email-lookup endpoint exists.

The default retention is 30 days after explicit saving, continuing the conservative trial setting. This is a configurable implementation setting, not a newly approved business rule. The consent text displays the configured duration. Expired profiles cannot be retrieved; a protected daily Vercel job removes expired rows. Same-browser expiry checks also remove that browser's expired row. Reads alone do not renew consent or expiry.

## Server configuration

Existing Supabase server credentials are reused. No new subscription or email provider is required.

- AOC_CLIENT_PROFILES_ENABLED=true; existing server gate and intake-only flags must also be true.
- AOC_CLIENT_PROFILE_TTL_DAYS=30 by default; the consent wording follows this setting.
- AOC_LOCAL_CLIENT_PROFILES_ENABLED=false in production.
- CRON_SECRET: server-only sensitive value, minimum 32 characters. Never expose it through a VITE variable. Vercel supplies its authorization header to the daily cleanup endpoint.

The [migration](../supabase/migrations/20261104000100_client_profiles.sql) creates only the new profile table/index and restricted cleanup function. Existing submissions, estimates, approvals and pricing are not changed. The revision UUID changes on an update; it is not a verified person ID.

Run npm run profiles:db:setup once, then npm run profiles:db:check. The production settings have been prepared for the next deployment. Setup preserves existing cleanup secrets, including sensitive values that the CLI cannot download. Saving is optional and fails safely if storage is unavailable; it never falls back to a local file in production.

Production API routes: /api/client-profile, /api/client-profile/status, /api/client-profile/cleanup. These use the active Vercel Node deployment. The retained Worker calculator does not advertise profiles. The browser discovers availability from the server; development build flags are not required.

## Test and release

- npm run test:profiles: shared/offline protocol plus production REST, consent, HTTPS cookie, stale-update/deletion, concurrency, provenance, request bounds and failure checks.
- npm run test:profiles:database: opt-in real Supabase persistence, ownership, concurrency, selective removal, expiry and deletion; only its synthetic rows are removed. Global cleanup is checked inside a rolled-back transaction.
- npm run test:profiles:cloud-ui: production-built React, real Node handlers and Supabase, desktop/mobile entry and company-fact journeys. Both saving choices are checked independently. No paid AI calls.
- npm test: complete application regression suite, including profile protocol tests.

For an offline preview, npm run dev:profiles uses the same handlers with a local SQLite adapter at http://127.0.0.1:5174/. For a real-database preview, npm run dev:profiles:database uses http://127.0.0.1:5180/. Saving requires explicit consent. Offline trial records are not copied to Supabase automatically.

Publishing is separate: push/redeploy the tested version, check the three profile endpoints on the AOC domain, perform one consent/reuse/forget journey and inspect the cleanup job in Vercel. A failed purge returns a failure status for the job logs. Sensitive CRON_SECRET values need not be downloaded for local tests.

Source scope: [Task #9](https://docs.google.com/document/d/1ZR-7dAayjtmejgo6GQrtJeI3FSj3kGjNeq_7zIuEPMA/edit).
Technical references: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PostgREST conditional updates](https://docs.postgrest.org/en/stable/references/api/tables_views.html), [Vercel protected cron jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
