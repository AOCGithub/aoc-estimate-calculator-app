# Entry and saved-data maintenance

Status: operational
Reviewed: 25 November 2026

This guide covers the current production entry and optional persistence behavior. It inherits the precedence rule in [documentation governance](DOCUMENTATION-GOVERNANCE.md).

## Current entry

Visitors provide name, company, website, role and business email, then complete reCAPTCHA. Email ownership verification and mandatory AOC approval are paused; entry is not proof of identity or approval.

Both persistence choices start unchecked:

- **Remember my business details** stores a private same-browser profile for review and reuse.
- **Save my details and estimates with AOC** stores the entry and linked calculation snapshots.

Either, both or neither can be selected. The signed server session carries the choice; request-body flags cannot grant saving. AI/provider processing is separate from database-saving consent.

## Find saved records

In Supabase Table Editor:

1. Find the submission in `access_requests` by `business_email` and copy its `id`.
2. Filter `estimates.access_request_id` by that ID.
3. Inspect each matching snapshot; repeated submissions with the same email are separate records.
4. Optional remembered details and company facts are in `client_profiles`.

There is no client-facing estimate history or email-based record-recovery feature.

## Delete a saved submission

Delete matching `estimates` rows first, then the parent `access_requests` row. Delete a `client_profiles` row separately only when that separately consented profile is also in scope. This is irreversible; verify exact UUIDs before deletion.

## Release checks

- Blank required fields and an unsolved CAPTCHA block entry.
- Each consent combination stores only the authorized data.
- Database failure never produces a false saved confirmation.
- Changed or cleared answers create a new supported result; earlier snapshots remain immutable.
- Logout clears the active browser journey without deleting already saved records.
- Desktop and mobile journeys remain usable.

Use `npm run test:access`, `npm run test:profiles`, `npm run test:recaptcha` and the opt-in database checks in [Tests](../tests/README.md). Keep database, session and provider secrets server-side.

The retained review/allowlist modes are documented as inactive references under `docs/features/`; they do not define current production entry.
