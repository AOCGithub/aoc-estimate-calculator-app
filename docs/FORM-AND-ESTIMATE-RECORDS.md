# Form and calculation records

Implemented locally on 29 October and deployed on 30 October 2026. Verification and approval remain paused. The live form and linked calculation saving passed desktop/mobile checks; see [production test results](PRODUCTION-TEST-RESULTS.md). Tables use the connected Supabase database, not a separate local database.

## Linked tables

- `public.access_requests`: existing five-field form records (name, company, website, role, business email), UUID `id`, timestamp and review status. Existing records are preserved; new submissions stay `pending`.
- `public.estimates`: new UUID `id`, timestamp, `access_request_id` foreign key, business area, answer snapshot, scope-confirmation flag, server-calculated result, calculator version and pricing version.

One form submission can have many estimate snapshots. Each successful server calculation adds a record; changed or cleared answers produce a new snapshot rather than overwriting earlier results. Local-preview fallback calculations are not saved. A failed database write leaves the calculation visible and explicitly reports that it was not saved.

The parent ID identifies a submission, not a verified person. Re-entering the form creates another submission, even with the same email. Returning-client identification, saved-profile recovery and a client-facing history screen are not included.

## Use and inspect

1. Run `npm run dev:access`; open http://localhost:5173 and submit the five details.
2. Complete the calculator and calculate. Successful storage shows **Estimate calculated and saved.**
3. In Supabase **Table Editor → public → access_requests**, find the submission and copy its `id`.
4. Open **estimates** and filter `access_request_id` by that value to see its calculation records.

The server selects the parent ID from its signed HTTP-only session, never a submitted owner ID. Old sessions without this link need the entry form once again. Browser keys cannot read or write either table. Estimates have RLS enabled and insert-only server permissions; no public history endpoint was added. Deleting a form record is restricted while estimates reference it, preventing accidental history loss.

## Configuration and checks

`AOC_ESTIMATE_RECORDS_ENABLED=true` enables recording only with server gating and intake-only mode enabled. The local launcher sets it; the example defaults to false. Review/allowlist modes remain available without recording. No pricing rules changed.

- `npm run estimates:db:setup`: apply the additive migration only if the table is absent, then check security.
- `npm run estimates:db:check`: check the foreign key, index, RLS and grants.
- `npm run test:intake-access:db`: real desktop/mobile form and calculation storage test; removes only its synthetic records.
- `npm test`: application regression checks, including server-selected ownership and save failures.

The setup script applies SQL directly, matching the existing project workflow; it does not register Supabase CLI migration history. Do not blindly run `supabase db push` against this already-prepared project. No database subscription change or app deployment is included.

## Test results — 29 October 2026

Passed: full `npm test`; real Supabase + desktop/mobile form-to-Calculate journeys (1440px/390px); linked answer/result/version snapshots; recalculation after editing or clearing answers; unchanged earlier snapshots; save-failure warning with the result retained; signed-session owner enforcement; anonymous read/write denial; RLS and grant checks. Only synthetic records created by the tests were removed. Existing submissions were preserved. No paid AI calls, push or deployment were made.
