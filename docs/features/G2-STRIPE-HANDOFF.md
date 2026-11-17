# G2 — local Stripe test-purchase handoff

Updated: 17 November 2026. Branch: `feature/g2-stripe-handoff`.

The local implementation covers a reviewed submission, saved work-description reference, Stripe test checkout, purchase outcomes, receipt link and one audit intake per submission. Real Stripe sandbox acceptance is still pending the AOC account/key setup. The tests use signed fixtures and mocked Stripe API responses; they are not real purchases.

## Local flow

1. Complete and calculate a reviewed, unblocked scope with a final work description.
2. Open **Review test purchase** and explicitly consent to saving the submission and text for that purchase. Remembering a profile and saving ordinary estimates remain independent choices.
3. The server recalculates the answers and saves the exact reviewed description, answers, result and calculator version. Manual corrections are preserved; payment handling does not rerun AI extraction.
4. The server creates Stripe-hosted Checkout using the configured one-time USD **initial audit test item**. It sends only submission, work-description and purchase reference IDs in metadata. The indicative build price is not charged.
5. A signed Stripe event is checked against the current Session, amount, currency, item and saved references. A completed-but-unpaid session is processing, not paid.
6. Confirmed payment creates one audit intake. Duplicate/concurrent events and server restarts retain that intake. Failed/expired payments preserve the submission for retry without creating a paid intake.
7. The return page shows the outcome, references, amount and confirmation time. Paid purchases can open Stripe's receipt when available. The saved estimate and purchase details can be downloaded; later calculator edits do not rewrite them.

This test flow does not approve customer scope, guarantee app compatibility, accept the indicative build price or redeem an audit credit. G3 email drafts and rehearsal project creation are not included.

## Stripe setup needed from Gino

Use an AOC-owned account and its sandbox/test environment. Create an active **one-time USD** test product/Price, clearly named **Initial audit — G2 test**. The demonstration amount is test data, not a new AOC price.

Add these server-only values to the Git-ignored `.env.stripe.local` file in the repository root:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_TEST_AUDIT_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Do not paste secrets or raw card details in chat, commit them, or use `VITE_` names for secret values.

Install the [Stripe CLI](https://docs.stripe.com/stripe-cli), authenticate to the same AOC test account/environment, and keep its listener running:

```powershell
stripe login
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired,payment_intent.payment_failed --forward-to http://localhost:5173/api/payments/webhook
```

Copy the listener's `whsec_...` into `.env.stripe.local`. This is the local listener secret, not an unrelated Dashboard endpoint secret. Restart the preview after changing that file:

```powershell
npm run dev:g2
```

Open **http://localhost:5173/**. The G2 panel shows setup guidance until all three settings exist and Stripe validates the test Price. The CLI is not bundled with the app. Stripe keys must be test keys; real payments are rejected.

Use the checkout created by this app for the real sandbox demonstration. A generic CLI event without the saved app references is ignored and does not prove the handoff. Follow [Stripe testing guidance](https://docs.stripe.com/testing); no real card details are needed.

## Acceptance checks

| Scenario | Expected outcome |
| --- | --- |
| Successful test purchase | One paid intake, linked references and receipt when available |
| Duplicate/concurrent notifications | Same intake; no duplicate |
| Simultaneous checkout clicks | Same active purchase and Stripe idempotency key |
| Completed but unpaid | Processing; no paid intake or receipt |
| Failed payment | No paid intake; retry can reuse the open Checkout Session |
| Expired checkout | New attempt linked to the original submission/text |
| Persistence failure | Retryable response; no falsely acknowledged result |
| Replay after restart | Same persisted intake reference |
| Invalid signature, live mode, wrong amount/currency/reference | Rejected; no paid intake |
| Another session | Cannot read or retry a purchase by guessing its ID |

Stripe's hosted receipt and the downloaded estimate are separate. Test purchases do not automatically email receipts; no confirmation-email sending has been added. See [Stripe receipts](https://docs.stripe.com/receipts).

## Storage and limits

- Rehearsal data uses `artifacts/g2/stripe-handoff.sqlite`, excluded from Git and blocked from Vite file serving. The G2 launcher disables live Supabase recording; no Supabase table or migration was added.
- `g2_submissions` stores the final text, immutable answer/result snapshot, owner-cookie digest and two reference IDs. The recording reference identifies reviewed text, not an audio file.
- `g2_purchases` records payment attempts/outcomes; `g2_stripe_events` records processed event IDs. The `g2_audit_intakes` view exposes the one intake assigned on confirmed payment.
- Unique keys and a short SQLite transaction prevent duplicate intake creation. Stripe idempotency keys protect checkout creation. Late failed events cannot downgrade a confirmed paid outcome.
- Ownership uses the existing signed HTTP-only calculator session. It is not verified identity, cross-device recovery or an account/history feature. Access after session expiry needs a future recovery design; an email alone cannot retrieve records.
- Browser/server G2 flags default to false. The handler also refuses Vercel and non-loopback hosts. **This local SQLite adapter must not be deployed as production persistence.** A durable hosted adapter/migration and release review are needed before hosted access.
- Calculator pricing rules, the documented missing historical-audit-date issue and the G3 email/project integrations are unchanged.

## Code and verification

- `server/payments/`: Checkout/webhook handling and transactional local storage.
- `api/payments/`: status, checkout and webhook entry points, disabled outside local rehearsal.
- `src/features/payments/`: purchase review, outcomes, receipt and saved-estimate download.
- `npm run test:g2`: signed fixtures, mocked Stripe API responses, local database/restart tests and component browser checks at 1440/390/320px. No real Stripe purchase, Supabase write or email.
- `npm test`: G2 plus the existing calculator, access, profile, CAPTCHA, voice and API regressions.

The first broad regression found a payment-status request when G2 was off. The explicit browser flag now prevents mounting that panel in the normal build; access/loading checks passed again. Private-file checks cover synthetic G2 database/secret paths as well as environment files.

## Recorded local results — 17 November 2026

- All **20 backend checks** passed, including duplicate/concurrent requests/events, failed/incomplete payments, immutable corrections, session isolation, signature/mode/reference/amount validation, transaction rollback and persisted restart/replay protection.
- Purchase-component browser checks passed at 1440px, 390px and 320px, including unchecked consent, pending/failed states, receipt gating, saved-detail downloads, setup/disabled states and no horizontal overflow.
- The full **`npm test`** suite passed after the browser-flag correction, including existing calculator journeys, pricing, access/profiles, CAPTCHA, voice, API adapters and artifact validation. Pricing data and formulas were not changed.
- The actual G2 development server on port 5173 passed a synthetic no-save entry/logout smoke check, all 12 area choices, G2-panel availability and 390px layout. No checkout was started, no paid AI was called and both saving choices remained unchecked.
- At that smoke check, the Stripe test key, Price ID and webhook secret were still missing. A real Stripe sandbox purchase, Stripe-originated webhook replay and real sandbox receipt have **not** been marked passed.

References: [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment.md?ui=full-page), [webhooks](https://docs.stripe.com/webhooks), [receipts](https://docs.stripe.com/receipts).
