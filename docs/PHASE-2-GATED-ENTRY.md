# Phase 2 gated entry

Status: five-field gate and server-side access foundation implemented locally; verification and AOC review workflow require confirmation

The local gate collects the five Task #8 fields: name, company, website, role and business email. It does not request LinkedIn access or email-inbox access, save a reusable client profile, enroll anyone in marketing, or trigger unsolicited follow-up.

The gate remains disabled by default and must not be enabled for client access until the open decisions below are confirmed and implemented.

## Implemented locally

- The existing calculator is blocked behind the five-field entry screen when the local gate is enabled.
- The form accepts a basic business email and company website without requiring an `https://` prefix.
- Calculator and AI endpoints require a valid signed session while the server gate is enabled.
- Sessions use an HTTP-only, same-site cookie and can be ended from the calculator.
- Removing an email from the provisional allowlist revokes its existing session.
- No reusable profile or marketing record is created.
- Desktop and mobile gate coverage is included in the automated tests.

## Current provisional access check

For local development only, `AOC_APPROVED_EMAILS` can contain test email addresses. A matching address receives a signed session.

This is an allowlist check, not business-email ownership verification. Someone who knows an allowlisted address could enter it. It also is not a complete AOC review workflow: the calculator does not send a request to AOC, provide an approval screen, or record an approve/reject decision.

The provisional list must not be described as completed verification or used for client release without AOC confirming that this is the intended review method.

## Decisions required before Task #8 is complete

1. **Email verification:** Confirm whether the visitor receives a magic link or one-time code, and which business-owned email service and sender domain will deliver it.
2. **AOC access review:** Confirm where AOC receives requests and approves, rejects, blocks or revokes them—for example, an admin screen, an approval email workflow, or a deliberately managed list.
3. **Review ownership and policy:** Identify the AOC reviewer and the rules for spam, competitors and unsuitable use.
4. **Access-request records:** Confirm where the five submitted fields and review status are stored, who can see them, and how long they are retained. This is separate from the optional reusable client profile in Task #9.
5. **Sequence and messages:** Confirm whether email verification happens before or after AOC review and what the visitor sees while approval is pending or rejected.

No email provider, database, admin dashboard, approval notification or retention policy has been assumed or added.

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

Run `npm test`. Current automated checks cover the five required fields, provisional allowlist matching, rejection of unapproved emails, signed sessions, revocation, API enforcement, logout, absence of reusable profile storage and mobile layout.
