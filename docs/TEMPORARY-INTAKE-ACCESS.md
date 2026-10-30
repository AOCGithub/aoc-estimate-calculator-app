# Temporary local entry — verification on hold

Requested on 29 October 2026 and published on 30 October 2026. The live estimator now uses the same submit-and-enter flow. See [production test results](PRODUCTION-TEST-RESULTS.md).

## Current flow

1. Run `npm run dev` (or `npm run dev:access`) and open http://localhost:5173.
2. Enter name, company, website, role and business email.
3. Choose the optional **Save my details and estimates with AOC** checkbox. It starts unchecked. Without it, the calculator opens without writing the details or estimates to AOC's database. With it selected, the details must save successfully before entry; calculations then save linked snapshots. A failed requested save keeps the form editable, and the visitor can retry or uncheck the option.

Verification, AOC approval and private links are not required in this temporary mode. Records remain `pending`; entry does not mark anyone verified or approved. The HTTP-only session lasts eight hours by default, so refreshing does not require the form again. Logging out or an expired session requires another submission.

When saving is selected, the five entry details and server-calculated estimate snapshots use [linked form and estimate tables](FORM-AND-ESTIMATE-RECORDS.md). The signed session carries the saving choice across refreshes. Missing consent and older sessions do not authorize new writes. Existing saved records are preserved. AI features still process descriptions submitted to them; the no-save choice applies to AOC's database. No reusable profiles, email provider or marketing were added.

Ending a session clears the estimate held on the page, including unsaved answers, before another visitor enters. Previously saved database records are not removed.

On 30 October 2026, the visible “Checking access” loading card was removed. The session check still runs before the entry form or calculator appears; the header stays visible while it completes.

On 30 October 2026, the standard `npm run dev` command was changed to use this same save-and-continue launcher. Previously it could start the older approval-only mode. The estimator also no longer shows the AOC-approval restriction notice while intake-only mode is active. Email format and required-field checks remain; email ownership verification, allowlist approval and invitations are not required in this mode.

## Restore review later

Stop the local server, then run `npm run dev:access:review` for the preserved [manual-review/private-link flow](MANUAL-ACCESS-TRIAL.md). `npm run dev:access:previous` restores the older provisional allowlist instead. Existing submissions are not deleted.

`AOC_INTAKE_ONLY_ENABLED=true` selects this temporary server mode. The example configuration defaults to false; production is configured separately with the paired gate, storage and estimate-record flags enabled and manual review disabled. Temporary sessions are not accepted by restored review/allowlist modes.

## Checks — 29 October 2026

Passed real Supabase/browser tests at 1440px and 390px: required fields, saving all five details, save-failure recovery, immediate entry without approval or a link, pending status, reload/logout, calculator output parity and no horizontal overflow. The full `npm test` suite passed. Only the two synthetic records created by this test were removed; existing submissions were preserved. No paid AI calls or deployment were made.

Rechecked on 30 October 2026 after restarting with `npm run dev`: full `npm test` and real Supabase desktop/mobile journeys passed. Non-approved synthetic emails entered immediately after saving, linked calculations were saved, and approval-only wording was absent. Only the tests' own two form records and eight estimate snapshots were removed; existing records were untouched. No production deployment or paid AI calls were made.
