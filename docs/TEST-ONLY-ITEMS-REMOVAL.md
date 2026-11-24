# Test-only items to remove before client release

Last reviewed: 24 November 2026

This note records temporary items used to test the calculator-to-Stripe handoff. They are not approved prices or real client billing settings.

## Fictional audit quote

- **Temporary amount:** $1,250 USD.
- **Reason:** the approved pricing workbook leaves the fixed audit fee individually quoted and unpriced. A known amount is needed to complete the Stripe sandbox journey while that commercial price is still unspecified.
- **Production setting:** `AOC_G2_SYNTHETIC_AUDIT_QUOTE_CENTS=125000` in Vercel Production.
- **Safety:** the app accepts this fixture only when Stripe is using an `sk_test_` key. The interface, PDFs and emails identify the transaction as a sandbox test with no real charge or audit booking.

Before client release:

1. Remove `AOC_G2_SYNTHETIC_AUDIT_QUOTE_CENTS` from Vercel and redeploy.
2. Confirm the calculator no longer displays or attaches the fictional $1,250 quote automatically.
3. Remove the synthetic-quote handler, UI notice, release warning and their fixture-specific assertions if AOC no longer needs sandbox rehearsals. The relevant locations are:
   - `server/payments/stripe-handoff.mjs`
   - `src/features/payments/AuditCheckout.jsx`
   - `src/features/payments/test-purchase.css`
   - `scripts/release/synthetic-quote-warning.mjs`
   - `.githooks/pre-push`
   - the `prebuild` script in `package.json`
   - the synthetic-quote checks in the G2 integration and browser tests
4. Keep the general payment security and regression tests; update only the fictional fixture expectations.

## Stripe sandbox mode

The current G2 handoff deliberately uses Stripe test mode. The test secret key, webhook secret, test feature flags, test receipts and `[Stripe test]` email wording are not a live billing setup.

Before accepting real payments:

1. Keep the sandbox isolated until AOC approves the real audit price, commercial terms and release plan.
2. Do not simply replace the test key with a live key. The current server intentionally rejects live-mode checkout and webhooks.
3. Implement and review a separate live-payment configuration, register its live webhook, and run a controlled release test without using real card details in chat or source code.
4. Remove or disable the sandbox-only flags after the reviewed live flow replaces them:
   - `AOC_STRIPE_TEST_HANDOFF_ENABLED`
   - `VITE_AOC_STRIPE_TEST_HANDOFF_ENABLED`

## Sandbox records

Test purchases, audit intakes, Stripe events and email-delivery rows are stored under the private `g2_sandbox` database schema. They are evidence of testing, not client orders.

Before client release, retain any test evidence required for handoff, then delete the remaining sandbox records through the approved database cleanup procedure. Do not treat sandbox receipts, emails or the fictional quote as revenue or approved client work.

## Release reminder

Until this checklist is completed, every push and production build should continue to show the fictional-quote warning. Any live update must state that the $1,250 quote is temporary, fictional and present only for Stripe sandbox testing.
