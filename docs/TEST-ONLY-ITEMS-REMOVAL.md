# Test-only payment boundary

Status: operational safety note
Reviewed: 25 November 2026

The deployed payment handoff is a Stripe sandbox rehearsal. It is not live billing.

## Current safeguards

- Server code accepts test keys/events only and rejects live mode.
- Browser and server sandbox flags default off and must be enabled together.
- Sandbox records are stored separately from real business records.
- UI, email subjects and records identify test mode.
- Failed, expired, incomplete, mismatched and duplicate events cannot create a new paid confirmation.
- The retired fictional `$1,250` audit quote and manual quote flow are not current rules.
- The current discovery fee is calculated as 15% of the complete one-time project estimate.

## Before any live-payment release

1. Obtain explicit approval for commercial scope, payment terms, sender/recipient, email wording and record destination.
2. Implement a separate live-mode configuration and review; do not merely replace the sandbox key.
3. Register and verify the live webhook and production storage.
4. Verify successful payment, failed payment, replay/idempotency, receipt, AOC email and project-record creation with an approved controlled plan.
5. Remove or disable the sandbox-only feature flags only after the reviewed live flow replaces them.
6. Retain required rehearsal evidence, then clean sandbox rows using an approved, exact-target procedure.

The Stripe receipt is not the AOC next-step email. Never send or label a real paid-order confirmation for a sandbox, failed, unpaid or duplicate payment.
