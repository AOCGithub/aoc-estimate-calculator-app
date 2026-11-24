# G3 confirmation and rehearsal record

Status checked on 24 November 2026. G3 implementation is isolated on
`feature/g3-confirmation-rehearsal` until the dependencies below are agreed.

## Already available from G2

- A server-verified Stripe `paid` result is required before the payment-email path runs.
- Failed, expired, incomplete and unpaid payments do not send payment confirmations.
- A repeated Stripe event retains one audit intake and one delivery record per recipient.
- The saved submission, reviewed work-description record, purchase and audit-intake references are available.
- The Stripe receipt remains separate from the AOC next-step email.
- Sandbox messages are clearly marked as tests and do not claim a real charge or audit booking.

These controls have automated fixture coverage. Actual inbox receipt was tested separately during G2 setup; no real email or payment is produced by the automated tests.

## Inputs required before the G3 connection

Confirm with Vianca/Diana:

1. Whether the agreed payment scope includes both AOC email dispatch and creation or linking of a rehearsal project record.
2. The approved client and internal email wording from task 19913169.
3. The successful-payment trigger: Stripe reports `paid`, the amount and references match the saved purchase, and the payment is not a duplicate.
4. The approved sender mailbox, client recipient source and internal AOC recipient or recipients.
5. The rehearsal record destination. Specify whether this is the estimator's private database or an external project system, and provide its required fields and access method.
6. Whether sandbox tests should send clearly labelled test messages to designated test recipients or remain capture-only.

## Proposed minimum fields

The record can carry existing verified data without collecting new card information:

- submission reference
- reviewed work-description record reference
- purchase reference
- audit-intake reference
- Stripe Checkout and payment references
- payment outcome, currency, amount and confirmation time
- client name, company and business email already supplied to the calculator/Stripe
- immutable estimate snapshot and pricing/calculator versions
- Stripe receipt URL
- email-delivery state for the client and AOC copies

Raw card details must never be requested or stored.

## Remaining active effort

If the destination is a new private record in the existing G2 database and the wording/recipients are supplied, allow **5-7 active hours** for the migration, transaction-safe link, approved email update, automated tests, one designated sandbox inbox test, deployment and handoff note.

If the rehearsal record belongs in an external project system, its API, authentication and field mapping must be reviewed first. That integration is not included in the 5-7 hours; an updated estimate can be given after the destination is identified.

