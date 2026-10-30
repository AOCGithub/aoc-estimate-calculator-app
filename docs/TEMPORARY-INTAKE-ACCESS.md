# Temporary local entry — verification on hold

Requested on 29 October 2026. Local only; live access is unchanged.

## Current flow

1. Run `npm run dev` (or `npm run dev:access`) and open http://localhost:5173.
2. Enter name, company, website, role and business email.
3. After the server saves the details to Supabase, the calculator opens immediately. A failed save keeps the entries editable and does not grant access.

Verification, AOC approval and private links are not required in this temporary mode. Records remain `pending`; entry does not mark anyone verified or approved. The HTTP-only session lasts eight hours by default, so refreshing does not require the form again. Logging out or an expired session requires another submission.

The five entry details and server-calculated estimate snapshots are now saved in [linked form and estimate tables](FORM-AND-ESTIMATE-RECORDS.md). No reusable profiles, email provider or marketing were added. Submissions use the connected Supabase database; they are not stored in a separate local database.

On 30 October 2026, the standard `npm run dev` command was changed to use this same save-and-continue launcher. Previously it could start the older approval-only mode. The estimator also no longer shows the AOC-approval restriction notice while intake-only mode is active. Email format and required-field checks remain; email ownership verification, allowlist approval and invitations are not required in this mode.

## Restore review later

Stop the local server, then run `npm run dev:access:review` for the preserved [manual-review/private-link flow](MANUAL-ACCESS-TRIAL.md). `npm run dev:access:previous` restores the older provisional allowlist instead. Existing submissions are not deleted.

`AOC_INTAKE_ONLY_ENABLED=true` selects this temporary server mode. It defaults to false in the example configuration; no live Vercel settings were changed. Temporary sessions are not accepted by the restored review/allowlist modes.

## Checks — 29 October 2026

Passed real Supabase/browser tests at 1440px and 390px: required fields, saving all five details, save-failure recovery, immediate entry without approval or a link, pending status, reload/logout, calculator output parity and no horizontal overflow. The full `npm test` suite passed. Only the two synthetic records created by this test were removed; existing submissions were preserved. No paid AI calls or deployment were made.

Rechecked on 30 October 2026 after restarting with `npm run dev`: full `npm test` and real Supabase desktop/mobile journeys passed. Non-approved synthetic emails entered immediately after saving, linked calculations were saved, and approval-only wording was absent. Only the tests' own two form records and eight estimate snapshots were removed; existing records were untouched. No production deployment or paid AI calls were made.
