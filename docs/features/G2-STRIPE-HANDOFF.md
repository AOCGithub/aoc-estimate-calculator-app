# G2 — local Stripe test-purchase handoff

Updated: 24 November 2026. Branches synchronized with `main`.

## Confirmed 15% audit-fee rule — 24 November 2026

The fictional $1,250 sandbox quote and manual audit-quote step have been removed. The current confirmed rule is:

> Initial audit fee = 15% of the complete one-time project estimate.

The project total uses the entered one-time project quote when all quoted components are supplied; otherwise it uses the calculator's complete build estimate. Monthly support, advertising spend, software subscriptions and other client-paid third-party costs remain separate. The server recalculates the project and audit amounts, saves the 15% fee against the immutable submission fingerprint, and rejects browser overrides or stale saved fees.

Stripe remains in test mode. Sandbox receipts and emails still say that no real charge or audit booking occurred.

## Superseded fixed-quote flow — 23 November 2026

The following section is retained as history and is no longer the active calculation or payment flow. The 24 November confirmed 15% rule above replaces it.

The payable audit fee no longer comes from an editable calculator answer. The client completes the estimate and explicitly submits the saved scope for AOC review. AOC then records the fixed USD audit fee against that submission's immutable fingerprint. Stripe checkout remains unavailable until that private quote exists, and the client reviews the saved scope and exact fee before continuing.

- No audit amount is inferred from the preliminary build estimate or an automatic percentage.
- `g2_sandbox.audit_quotes` stores the AOC reviewer, fixed amount and saved-scope fingerprint; browser roles have no access to the table.
- A quote cannot be changed after a purchase record exists.
- Stripe metadata carries the submission, work-description, quote and purchase references.
- The original estimate, failed/incomplete payment handling, duplicate-event protection, receipt, PDF and payment emails remain unchanged.
- An approved sandbox quote is recorded with `npm run g2:audit-quote -- <submission-reference> <amount> <AOC-reviewer>` after AOC reviews the saved scope.

At the time, this implemented the earlier fixed-quote instruction. It is retained only to explain historical records and tests; it is not the current pricing flow.

The local implementation covers a reviewed submission, saved work-description reference, server-calculated 15% audit fee, Stripe sandbox checkout, purchase outcomes, receipt link and one audit intake per submission. No manually created Price ID or sample payment amount is required. Automated fixture tests and actual Stripe sandbox checks are recorded separately below.

## Local flow

1. Complete and calculate a reviewed, unblocked scope with a final work description.
2. Open **Review audit payment** and explicitly consent to saving the submission and text for that purchase. Remembering a profile and saving ordinary estimates remain independent choices. Select **Continue to Stripe** to open Checkout.
3. The server recalculates the answers and saves the exact reviewed description, answers, result and calculator version. Manual corrections are preserved; payment handling does not rerun AI extraction.
4. The server creates Stripe-hosted Checkout with exactly **15% of the saved one-time project estimate**, rounded to USD cents. Missing project totals, stale calculations and client-supplied price overrides block checkout. It sends only submission, work-description, saved audit-price and purchase reference IDs in metadata. The project estimate itself is not charged.
5. A signed Stripe event is checked against the current Session, amount, currency, item and saved references. A completed-but-unpaid session is processing, not paid.
6. Confirmed payment creates one audit intake. Duplicate/concurrent events and server restarts retain that intake. Failed/expired payments preserve the submission for retry without creating a paid intake.
7. The return page shows the outcome, references, amount and confirmation time. Paid purchases can open Stripe's receipt when available. The saved estimate and purchase details can be downloaded; later calculator edits do not rewrite them.

This test flow does not approve customer scope, guarantee app compatibility, accept the indicative build price or redeem an audit credit. G3 email drafts and rehearsal project creation are not included.

## Stripe setup needed from Gino

Use an AOC-owned account and its sandbox/test environment. Do not create a fixed product Price for this flow. Each Checkout uses the server-recalculated 15% audit fee for that saved project estimate.

Add these server-only values to the Git-ignored `.env.stripe.local` file in the repository root:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Do not paste secrets or raw card details in chat, commit them, or use `VITE_` names for secret values.

Install the [Stripe CLI](https://docs.stripe.com/stripe-cli). Run the helper in a separate terminal and leave it running:

```powershell
npm run dev:g2:stripe
```

The helper uses the configured sandbox key so events come from the same environment as checkout. It saves the listener's `whsec_...` into `.env.stripe.local` without displaying it. This is the local listener secret, not an unrelated Dashboard endpoint secret. Restart the preview after changing that file:

```powershell
npm run dev:g2
```

Open **http://localhost:5173/**. The G2 panel shows setup guidance until both settings exist, and purchase review is disabled until the current calculation has a complete one-time project estimate and its 15% audit fee. The CLI is not bundled with the app. Stripe keys must be test keys; real payments are rejected. The preserved `.env.stripe.live.local` is Git-ignored and is not loaded by either G2 development command.

Use the checkout created by this app for the real sandbox demonstration. A generic CLI event without the saved app references is ignored and does not prove the handoff. Follow [Stripe testing guidance](https://docs.stripe.com/testing); no real card details are needed.

Stripe returns to **`/payment/status`** after checkout or cancellation. The page shows the outcome for the browser session that started checkout. Use **View Stripe receipt** after confirmation, **Download payment & estimate (PDF)** for the saved details, or **Continue payment** to retry an incomplete checkout. Older Stripe links with a purchase reference on the calculator URL also open the payment status view.

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
| Missing/blocked project total or unsupported precision | Checkout blocked; no audit price is saved |
| Different project totals | Each checkout uses exactly 15% of its immutable saved project estimate; retries retain it |
| Another session | Cannot read or retry a purchase by guessing its ID |

Stripe's hosted receipt and the downloaded estimate are separate. A confirmed sandbox payment sends the separately configured AOC next-step emails; the Stripe receipt remains Stripe's own document. Failed, incomplete or duplicate events cannot create a new paid-order confirmation.

## Storage and limits

- Payment rehearsal data uses `artifacts/g2/stripe-handoff.sqlite`, excluded from Git and blocked from Vite file serving. No G2 payment table or migration was added to Supabase. Normal visitor details, saved profiles and estimate snapshots use the existing Supabase database when their separate saving choices are selected, as requested for the local preview.
- `g2_submissions` stores the final text, immutable answer/result snapshot, owner-cookie digest and two reference IDs. The recording reference identifies reviewed text, not an audio file.
- `g2_purchases` records payment attempts/outcomes; `g2_stripe_events` records processed event IDs. The `g2_audit_intakes` view exposes the one intake assigned on confirmed payment.
- Unique keys and a short SQLite transaction prevent duplicate intake creation. Stripe idempotency keys protect checkout creation. Late failed events cannot downgrade a confirmed paid outcome.
- Ownership uses the existing signed HTTP-only calculator session. It is not verified identity, cross-device recovery or an account/history feature. Access after session expiry needs a future recovery design; an email alone cannot retrieve records.
- Browser/server G2 flags default to false. The local mode accepts loopback hosts. Vercel requires the exact configured HTTPS origin and uses the private Supabase sandbox schema described below.
- Calculator pricing rules, the documented missing historical-audit-date issue and the G3 email/project integrations are unchanged.

## Code and verification

- `server/payments/`: Checkout/webhook handling and transactional local storage.
- `api/payments/`: status, checkout and webhook entry points, disabled until sandbox mode is explicitly enabled.
- `src/features/payments/`: purchase review, outcomes, receipt and saved-estimate download.
- `npm run test:g2`: signed fixtures, mocked Stripe API responses, local database/restart tests and component browser checks at 1440/390/320px. No real Stripe purchase, Supabase write or email.
- `npm test`: G2 plus the existing calculator, access, profile, CAPTCHA, voice and API regressions.

The first broad regression found a payment-status request when G2 was off. The explicit browser flag now prevents mounting that panel in the normal build; access/loading checks passed again. Private-file checks cover synthetic G2 database/secret paths as well as environment files.

## Hosted sandbox checklist

1. Set up the private `g2_sandbox` schema with `node scripts/database/g2-database.mjs setup` under the target Vercel environment. Run the same script with `test` to check cross-connection checkout and webhook replay, session ownership, distinct estimates, and failed/expired outcomes. The test uses and removes its own synthetic rows. Ordinary saved estimates and profiles stay in their existing tables.
2. Register an AOC Stripe **sandbox** snapshot webhook at the target HTTPS origin plus `/api/payments/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `payment_intent.payment_failed`.
3. Set the sandbox `STRIPE_SECRET_KEY` and that endpoint's `STRIPE_WEBHOOK_SECRET` as sensitive variables for the target Vercel environment. Set `AOC_G2_HOSTED_ORIGIN` to the exact HTTPS origin without a trailing slash. Use `POSTGRES_URL` or a dedicated `AOC_G2_POSTGRES_URL`. When ready for rehearsal, set `AOC_STRIPE_TEST_HANDOFF_ENABLED` and `VITE_AOC_STRIPE_TEST_HANDOFF_ENABLED` to `true` and redeploy. Clear both flags and redeploy to disable the rehearsal.
4. Use synthetic entries to check paid, declined and expired checkout on the hosted URL. Confirm that a paid checkout has one intake, pending or failed ones have none, and replay preserves the same intake. Check the receipt, PDF and direct return-page URL. The live calculator's access form and CAPTCHA still apply. Real Stripe keys and events are rejected.

## Recorded local results — 17 November 2026

- All **20 backend checks** passed, including duplicate/concurrent requests/events, failed/incomplete payments, immutable corrections, session isolation, signature/mode/reference/amount validation, transaction rollback and persisted restart/replay protection.
- Purchase-component browser checks passed at 1440px, 390px and 320px, including unchecked consent, pending/failed states, receipt gating, saved-detail downloads, setup/disabled states and no horizontal overflow.
- The full **`npm test`** suite passed after the browser-flag correction, including existing calculator journeys, pricing, access/profiles, CAPTCHA, voice, API adapters and artifact validation. Pricing data and formulas were not changed.
- The actual G2 development server on port 5173 passed a synthetic no-save entry/logout smoke check, all 12 area choices, G2-panel availability and 390px layout. No checkout was started, no paid AI was called and both saving choices remained unchecked.
- This initial smoke check preceded Stripe configuration. Its setup limitations are superseded by the 18 November results below; the fixed Price ID is no longer used.

## Recorded local and Stripe sandbox results — 18 November 2026

- All **22 backend checks** and purchase-component browser checks passed, including different quoted audit amounts, missing/invalid quotes, immutable retries, duplicate events, receipt gating and desktop/mobile layout. The full **`npm test`** regression suite passed, including calculator pricing, forms, access, profiles, CAPTCHA, voice, API adapters, private-file protection and the build artifact.
- An actual Stripe-hosted sandbox purchase passed. The unchanged calculator returned a **$1,250 audit quote**, and Checkout received exactly **$1,250 USD**. This was synthetic acceptance input, not a newly approved AOC fee or a fixed configured payment amount. The browser returned to localhost, the original signed Stripe completion event returned HTTP 200, one audit intake was recorded, and a Stripe receipt link was available.
- The paid test used submission `a8113dc8-64ab-4308-9891-1cd9f5899bd4`, work-description reference `2e972252-45fa-4c08-b805-55e9f83de546` and intake `e96adf4a-7666-4f24-971f-3fb5462d06e4`. References were carried into Stripe metadata and back to the saved purchase.
- An actual declined sandbox payment produced `failed`, no receipt and no paid audit intake. An actual expired sandbox Checkout produced `incomplete` through the Stripe listener and no paid intake.
- Duplicate checkout requests reused the same purchase. Three concurrent replays of the original paid-event payload retained the same single intake. The replay used a locally generated test signature over the original event fetched from Stripe; it was **not** a Stripe Dashboard resend. The original payment and expiry deliveries did come from Stripe through the CLI listener.
- Real sandbox testing identified a rejected `payment_method_types` parameter. Checkout now uses Stripe's supported `allowed_payment_method_types` filter. Browser fixtures and private-file fixtures also use separate available ports so they do not conflict with the local preview.
- Sandbox key and webhook setup were verified. The live key is preserved in the separate ignored `.env.stripe.live.local`, which G2 does not load. Neither key nor the signing secret appeared in the client build. No paid AI calls, live charges, emails, Supabase writes, push or deployment were performed.

Detailed local evidence is in the Git-ignored `artifacts/g2/` files: `sandbox-acceptance-20261118.json`, `sandbox-declined-20261118.json`, `sandbox-expiry-20261118.json` and `sandbox-paid-replay-20261118.json`. Screenshots there contain synthetic sandbox data. The hosted-storage/release limits above still apply.

## Local saving and AI prefill restored — 18 November 2026

The original isolated launcher disabled normal Supabase recording and did not enable the AI organizer. `npm run dev:g2` now loads the existing Vercel server settings, enables the existing organizer/voice/correction features and restores optional Supabase saving. The explicitly configured sandbox credentials override inherited Stripe settings; the preserved live-key file is not loaded. Payment rehearsal records still remain local.

- Both saving choices start unchecked and remain independent. The saving checkbox was checked, unchecked and checked again in the real local browser.
- Two clearly labeled synthetic submissions and their linked estimates were saved and verified in the existing Supabase database. The application REST credential does not permit direct estimate reads, so verification used read-only PostgreSQL queries; no permissions were changed.
- One actual paid-advertising AI request returned HTTP 200 with 151 extracted facts. The browser populated people/team counts, capability count, brand/language counts, monthly outputs, time/cost inputs and the explicit audit quote. Unknown audit/acceptance/payment dates stayed blank. No second paid AI request was made.
- Continuing without saving still skipped both submission storage and estimate recording. Payment status still reported sandbox mode.
- The G2, access/consent and local API regression checks passed after the startup changes. The earlier full regression pass is recorded above.

Local evidence: `artifacts/g2/restored-saving-prefill-20261118.json`, `restored-saving-only-20261118.json` and `restored-paid-advertising-prefill.png`. No push or deployment was performed.

## Paid-advertising prefill and result wording corrected — 18 November 2026

A saved paid-advertising result contained the project quote but lacked the stated capability count and production scope. The existing calculation correctly withheld its build total while scope was incomplete. Prefill now recovers explicitly stated counts and recurring AOC production from exact source excerpts when the AI omits them. Unknown, negated, conflicting or ranged quantities are not replaced with guesses, and manual corrections retain precedence.

Results now distinguish incomplete scope from missing support pricing. When time, savings and software inputs are present, the monthly-value label says **Awaiting support price** instead of asking for value details. The audit detail is labeled **Quoted initial audit**, not proof of payment. No pricing coefficients, credit rules or calculation formulas were changed.

The real local AI/browser check passed with 6 capabilities, managed production, 24 monthly outputs, the entered $11,500 project quote and the $1,250 audit quote. Support pricing and net value remained pending. Both database-saving choices were unchecked, and only one paid AI request was made. The full `npm test` suite passed after the fix, including desktop/mobile checks for omitted AI fields, manual corrections and clearing a required scope answer, plus existing pricing, access, saving, voice, G2 and API regressions. Evidence: `artifacts/g2/paid-advertising-prefill-fixed-20261118.json` and the matching desktop/mobile screenshots.

Existing saved estimates are unchanged. Reorganize the description and recalculate to generate an updated result. These changes remain local on the G2 branch.

## Simpler estimate and payment wording — 18 November 2026

Audit checkout now explains what the payment covers, separates it from build/monthly prices, and uses short payment-status messages. Reference numbers remain available under **Reference numbers** and in the download. The saved estimate, receipt, retry actions and separate saving consent remain available. Test checkout is clearly labeled as making no real charge.

Estimate explanations and downloaded payment details use simpler language. AI titles and summaries are instructed to describe the actual work in plain language. The quoted project price is identified separately from the planning breakdown, whose items are not added to that quote. Pricing, credit and payment-processing rules are unchanged.

Payment backend/browser checks, pricing-domain checks, complete desktop/mobile calculator journeys and the build passed. No additional paid AI requests, real payments, push or deployment were performed for these wording changes.

## Old purchase-link recovery — 18 November 2026

The current payment status page displays inaccessible-link guidance and a **Back to calculator** link. The original recovery flow below describes the earlier inline payment panel.

An old or inaccessible `purchase_reference` in the URL could show a session error and incorrectly describe checkout as unavailable. The payment panel now checks checkout configuration separately and offers **Use my current estimate**. This action clears only the payment-return URL parameters, preserves the current answers and description, and resets purchase review/consent. It does not create a payment or grant access to another session's purchase. The screen asks anyone who already paid to check their receipt with AOC before starting another payment.

Invalid/private-link, delayed-response, temporary-error/retry and normal payment-state browser checks passed, along with all 22 payment-backend checks and the build. The actual local browser recovery also passed with no AI call, checkout request or database saving. Evidence: `artifacts/g2/stale-return-recovery-20261118.json`. Ownership checks, pricing rules and saved records are unchanged; nothing was deployed.

## Customer-facing audit order summary — 18 November 2026

The local purchase flow now uses customer-facing headings and actions: **Initial audit & roadmap**, **Due today**, **Continue to payment**, **Payment received** and **View receipt**. One small sandbox notice remains; the server still rejects live keys and real-payment events.

Before payment, clients can see the audit scope, written findings/report, roadmap and proposed build quote, separate build/ongoing/software/ad costs, and the exact quoted one-time USD amount. Delivery, eligible credit and refund wording was checked against sections 3–4 of the [current agreement](https://docs.google.com/document/d/15BxB-yzw8U1oP_1B2cpJu2EUgh3P8rnqKT5_ZqdT3dA/edit), with the framework's approved one-off rules as a cross-check. The five-business-day target starts after AOC confirms required inputs are complete, unless a different period is agreed. Credit retains both acceptance and first-payment conditions within the current 30-calendar-day window after the approved audit is sent. Refund wording remains conditional on AOC being unable to validate and deliver a workable agreed approach.

Service wording is maintained in `server/payments/audit-service.mjs`. The credit window reads the existing approved pricing rule. New purchase records save a copy and version of the audit details shown at checkout; Stripe receives the same service name/description, and downloads retain those details. Older purchases are not assigned new terms retroactively. This does not automate audit delivery, credits, refunds or client communications.

Payment/browser checks passed at 1440, 390 and 320 pixels. An actual sandbox Checkout confirmed the name/description and unchanged $1,250 synthetic audit quote; it was expired unpaid. No real payment, AI call or Supabase save was made for that check. Evidence: `artifacts/g2/official-checkout-details-20261118.json` and `audit-review-official-*.png` screenshots. These changes remain local.

The full `npm test` suite passed after this update, including calculator/pricing, access, saved-data, CAPTCHA, voice, G2 payments, desktop/mobile journeys and artifact checks. No push or deployment was performed.

References: [Stripe fulfillment](https://docs.stripe.com/checkout/fulfillment.md?ui=full-page), [webhooks](https://docs.stripe.com/webhooks), [receipts](https://docs.stripe.com/receipts).

## Payment refresh and PDF summary — 18 November 2026

**Refresh payment status** now shows a checking state, a completion time and the current outcome, or a useful retryable error. An explicit refresh checks the owned Checkout session directly with Stripe and validates its test mode, references, amount, currency and line item before updating the saved outcome. This can recover a missed webhook without creating another checkout. Refresh and signed webhooks share the same transactional intake update; repeated checks retain one audit intake and cannot downgrade a confirmed payment. Background polling continues to read the saved outcome.

The document actions now have matching sizing and full-width mobile buttons. **Download payment & estimate (PDF)** replaces the text download with an AOC-branded template using the MIT-licensed [jsPDF](https://github.com/parallax/jsPDF) and [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) libraries. It includes the audit payment, saved client details where provided, separate project estimate and breakdown, original audit terms, references, work description and saved answers. Unknown figures remain pending; unpaid outcomes are clearly identified. Older purchases do not acquire current offer terms. The PDF uses the original snapshot without recalculating prices. PDF code and local font assets load when downloading; document data is not sent to a PDF service. Noto Sans is distributed with its SIL Open Font License.

Validation passed: 25 backend checks; parsed PDF checks for original amounts/terms, accented names, unknown costs, unpaid states and long-content pagination; and browser checks for download/retry, refresh/loading/error/retry, and 1440/390/320 layouts. A real Stripe sandbox Checkout was checked while pending, expired unpaid, and checked again through both the API and browser. The PDF downloaded successfully. No payment, paid AI call or Supabase save was made for this check. Evidence: `artifacts/g2/refresh-and-pdf-20261118.json`, `payment-estimate-template.pdf`, `actual-sandbox-refresh-summary.pdf` and the updated desktop/mobile screenshots. Changes remain local on the G2 branch.

The full `npm test` regression suite passed. A separate G2-enabled build also passed and confirmed that the PDF generator is a separate download chunk. Existing pricing/calculation files are unchanged. No push or deployment was performed.
