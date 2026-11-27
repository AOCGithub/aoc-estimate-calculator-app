# Stripe sandbox handoff

Status: operational rehearsal feature
Reviewed: 27 November 2026

The shared payment path applies to every active estimator category. Paid Advertising is Coming Soon and is not a special exception.

## Current amount and service

Service: **AI Commerce Discovery & Implementation Plan**
Fee: **15% of the complete one-time project estimate**

The server recalculates and locks the estimate and fee. The browser cannot override the amount. The retired fixed `$1,250` fixture, manual audit quote and Paid-Advertising-only checkout are superseded and must not return.

Monthly services, advertising spend, software subscriptions and other client-paid costs are separate from the charged discovery fee.

## Flow

1. Complete a supported active-category estimate and review the saved scope.
2. Review and explicitly accept the exact C10 order reference/version.
3. The server stores the accepted C10 plus the exact description, answers, result, rules version, service terms and references before Stripe Checkout.
4. Stripe Checkout receives the server-calculated 15% USD amount.
5. The webhook/refresh path validates signature, test mode, ownership, references, item, amount and currency against the current Stripe Session.
6. Only a confirmed paid session creates one rehearsal intake.
7. The status page exposes the outcome, receipt when available and an immutable estimate PDF download.
8. Verified-payment email attaches the accepted C10 and estimate as separate PDFs; the Stripe receipt remains separate.

Completed-but-unpaid is processing, not paid. Failed or expired attempts create no paid intake and can retain the original submission for retry. Duplicate/concurrent events and checkout requests remain idempotent.

## Local sandbox

Store only sandbox secrets in ignored `.env.stripe.local`:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

```sh
npm run dev:g2:stripe
npm run dev:g2
```

Use `npm run dev:g2:email` instead of `npm run dev:g2` only when you intentionally want the sandbox client and AOC support messages delivered to real inboxes.

Use Stripe test cards and the Checkout created by this app. Generic fixture events without the saved references do not prove the handoff. Local rehearsal payment data uses ignored SQLite storage; ordinary consented estimates/profiles keep their existing storage behavior.

Local payment email is enabled automatically in capture mode. After Stripe confirms the test payment, inspect `artifacts/g2/email-capture/` for the actual client/support email files, accepted C10 PDF and separate estimate PDF. No real email is sent.

## Hosted sandbox

1. Prepare and check the private `g2_sandbox` schema with the database tool.
2. Register the exact HTTPS `/api/payments/webhook` endpoint in the same Stripe test environment.
3. Configure test secret, webhook secret, exact `AOC_G2_HOSTED_ORIGIN` and Postgres connection.
4. Enable `AOC_STRIPE_TEST_HANDOFF_ENABLED` and `VITE_AOC_STRIPE_TEST_HANDOFF_ENABLED` together, then redeploy.
5. Use synthetic paid, declined and expired checkouts. Verify one intake for paid and none for the others; replay must retain the same intake.

Real Stripe keys and live events are intentionally rejected. See [Test-only payment boundary](../TEST-ONLY-ITEMS-REMOVAL.md).

## Acceptance matrix

| Scenario | Required result |
| --- | --- |
| Paid test purchase | One rehearsal intake, accepted C10 PDF, estimate PDF, receipt when available and eligible sandbox emails |
| Duplicate/concurrent event | Same intake and email claims; no duplicate |
| Completed but unpaid | Processing; no paid intake or confirmation |
| Failed/expired | No paid intake; safe retry path |
| Wrong signature/mode/amount/currency/reference | Reject with no paid intake |
| Persistence failure | Retryable failure; never acknowledge false success |
| Other browser session | Cannot read or retry the purchase |
| Any active category | Same discovery/payment rules |
| Coming Soon category | No calculation or checkout |

## G3 boundary

The Stripe receipt, accepted C10, AOC next-step email and rehearsal project record are separate outputs. The exact paid trigger and C10 attachment path are implemented in sandbox. Final email wording, sender/recipient and record destination still require Vianca/Diana approval. Never send a real paid-order confirmation for a sandbox, failed or duplicate payment.

Run `npm run test:g2`; the suite covers server calculation, ownership, idempotency, failure/replay protection, email routing, PDF and responsive payment UI with synthetic providers.
