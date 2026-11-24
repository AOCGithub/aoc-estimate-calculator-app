# Test-only items to remove before client release

Last reviewed: 24 November 2026

This note records temporary items used to test the calculator-to-Stripe handoff. They are not real client billing settings.

## Removed: fictional audit quote

- **Previous temporary amount:** $1,250 USD.
- **Previous reason:** it allowed the team to exercise Stripe while the audit amount was unspecified.
- **Removed on:** 24 November 2026.
- **Replacement:** the confirmed audit fee is calculated automatically as 15% of the complete one-time project estimate. Recurring support, advertising spend, software subscriptions and other client-paid third-party costs remain separate.

The Vercel variable, synthetic handler, UI notice, release warning, manual quote command and fixture-specific assertions were removed. General payment security and regression coverage remain.

## Stripe sandbox mode

The current G2 handoff deliberately uses Stripe test mode. The test secret key, webhook secret, test feature flags, test receipts and `[Stripe test]` email wording are not a live billing setup.

Before accepting real payments:

1. Keep the sandbox isolated until AOC approves the commercial terms and live-payment release plan.
2. Do not simply replace the test key with a live key. The current server intentionally rejects live-mode checkout and webhooks.
3. Implement and review a separate live-payment configuration, register its live webhook, and run a controlled release test without using real card details in chat or source code.
4. Remove or disable the sandbox-only flags after the reviewed live flow replaces them:
   - `AOC_STRIPE_TEST_HANDOFF_ENABLED`
   - `VITE_AOC_STRIPE_TEST_HANDOFF_ENABLED`

## Sandbox records

Test purchases, audit intakes, Stripe events and email-delivery rows are stored under the private `g2_sandbox` database schema. They are evidence of testing, not client orders.

Before client release, retain any test evidence required for handoff, then delete the remaining sandbox records through the approved database cleanup procedure. Do not treat sandbox receipts or emails as revenue or real client work.

## Remaining release reminder

The fictional-quote reminder is retired because the fixture has been removed. Continue to state that Stripe remains in sandbox mode until the separate live-payment release checklist is completed.
