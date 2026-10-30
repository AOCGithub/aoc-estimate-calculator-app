# Phase 2 gated entry

Status — 30 October 2026: five-field entry and linked Supabase calculation storage are deployed. Submission opens the estimator without approval. Email ownership verification and mandatory AOC review remain paused, not completed. See [production test results](PRODUCTION-TEST-RESULTS.md).

Verification and approval are now on hold at the user's request. The default local command uses [temporary save-and-continue entry](TEMPORARY-INTAKE-ACCESS.md): save the five details, then open the calculator immediately. Records remain pending. This convenience mode does not complete Task #8 verification or AOC review.

The preserved [manual-approval trial](MANUAL-ACCESS-TRIAL.md) is available with `npm run dev:access:review`: submit → pending → AOC review in Supabase → manually shared, single-use private link → calculator session. It does not add automated email delivery or claim email ownership verification. The provisional behavior below remains available with `npm run dev:access:previous`.

The local gate collects the five Task #8 fields: name, company, website, role and business email. It does not request LinkedIn access or email-inbox access, save a reusable client profile, enroll anyone in marketing, or trigger unsolicited follow-up.

The example flags remain disabled by default. The live testing preview deliberately uses submit-and-enter mode; the verification/review decisions below still apply to a later qualified-client release.

## Implemented locally

- The existing calculator is blocked behind the five-field entry screen when the local gate is enabled.
- The form accepts a basic business email and company website without requiring an `https://` prefix.
- Calculator and AI endpoints require a valid signed session while the server gate is enabled.
- Sessions use an HTTP-only, same-site cookie and can be ended from the calculator.
- Removing an email from the provisional allowlist revokes its existing session.
- When request storage is enabled, valid submissions are saved privately in Supabase as pending access requests. No reusable profile or marketing record is created.
- Desktop and mobile gate coverage is included in the automated tests.
- Temporary intake mode also saves [linked calculation snapshots](FORM-AND-ESTIMATE-RECORDS.md), as separately requested. This is not verified identity, reusable profiles or a client-facing history screen.

## Previous provisional access check (available for revert)

For local development only, `AOC_APPROVED_EMAILS` can contain test email addresses. A matching address receives a signed session.

This is an allowlist check, not business-email ownership verification. Someone who knows an allowlisted address could enter it. AOC can now review submitted details in Supabase Table Editor. Request submission and the table's review status do not grant calculator access; the provisional allowlist remains separate. No approval email or admin application has been added.

The provisional list must not be described as completed verification or used for client release without AOC confirming that this is the intended review method.

## Decisions required before Task #8 is complete

1. **Email verification:** Confirm whether the visitor receives a magic link or one-time code, and which business-owned email service and sender domain will deliver it.
2. **AOC access review:** Confirm where AOC receives requests and approves, rejects, blocks or revokes them—for example, an admin screen, an approval email workflow, or a deliberately managed list.
3. **Review ownership and policy:** Identify the AOC reviewer and the rules for spam, competitors and unsuitable use.
4. **Access-request records:** The five fields are now stored in a private Supabase table for AOC review, as requested. Retention policy and reviewer access still need to be set by AOC. This is separate from the optional reusable client profile in Task #9.
5. **Sequence and messages:** Confirm whether email verification happens before or after AOC review and what the visitor sees while approval is pending or rejected.

Supabase Free is connected through Vercel. No email provider, custom admin dashboard, approval notification or retention policy has been added. See [access-request setup](ACCESS-REQUESTS-SETUP.md) for local use and review instructions.

## Local-only provisional settings

    VITE_AOC_ACCESS_GATE_ENABLED=true
    AOC_ACCESS_GATE_ENABLED=true
    AOC_APPROVED_EMAILS=["local-test@example.com"]
    AOC_ACCESS_SESSION_SECRET=<random value of at least 32 characters>
    AOC_ACCESS_SESSION_HOURS=8

The browser flag shows the gate. The server flag protects the calculation and organizer APIs. Enable or disable the two flags together.

Never commit real email addresses or the session secret. The committed example keeps both flags disabled.

## Phase boundary

Task #8 covers access entry, verification, AOC review, privacy boundaries and calculator access control.

Optional reusable profile saving, an unchecked consent choice, returning-client prefill and client-separation tests remain Task #9. WordPress linking and the full client-release journey remain Task #10.

## Verification

Run `npm test`. Automated checks cover the five required fields, provisional allowlist matching, pending requests without access, save-failure handling, signed sessions, revocation, API enforcement, logout, absence of reusable profile storage and desktop/mobile layouts. The separate database test verifies actual Supabase persistence and anonymous access denial without retaining synthetic records.
