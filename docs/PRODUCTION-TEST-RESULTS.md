# Production test results

Status: operational release record
Latest release: 27 November 2026

Detailed historical test diaries were removed from the active tree to prevent obsolete behavior from being mistaken for current requirements. Git history retains earlier evidence.

## Current production release

- Application release: `54f5e16` — `Fix production loading for C10 PDF generator`
- Branch: `main`
- Vercel deployment: Ready
- Production URL: <https://estimate.alwaysopencommerce.com/>
- Rules version: `simplified-2026-11-25-v7-paid-advertising-coming-soon`

Verified on the public deployment:

- Vercel deployment `dpl_2xFrh2Qe65Bnui9AAWRwAJbLmjQj` completed Ready and is aliased to the production URL.
- Homepage and public access-status endpoint returned HTTP 200. An unauthenticated payment-status request returned HTTP 401 as expected.
- C10 now uses the actual client-facing Template V6 page artwork, populated with each accepted order's saved facts, scope, pricing and terms. The blank source page and AOC-only notes page are excluded.
- C10 PDF tests and visual inspection confirm the five-page output, filled order data, preserved table borders, no unresolved placeholders and safe overflow pages.
- A production-only module-loading error that stopped email creation was fixed by using the explicit `.mjs` extension for the C10 generator.
- The full `npm test` suite passed before deployment, including the production build and payment/email integration tests.
- Production logs showed the reported paid webhook returning HTTP 503 before the fix. Payment was recorded before email generation failed, so neither the customer nor support message was sent. No Stripe retry had arrived by the latest check.
- Production smoke checks were read-only; no additional payment or email was initiated.

## Release checks

Passed locally before deployment:

- Production client and Worker builds.
- Domain/calculation and simplified-rule tests.
- Access, profile, intake, Worker and Vercel adapter tests.
- Local pricing and current browser UI checks.
- Stripe backend: 27 payment/idempotency/failure/replay checks.
- Payment email routing and PDF generation tests.
- Stripe browser handoff in an approved browser run.
- The complete `npm run test:g2` suite, including headless Chrome, passed for the release candidate.

## Payment boundary

The deployed checkout remains Stripe test mode. The reported sandbox payment was recorded, but its email delivery failed before either message was sent. The module-loading fix is deployed; Stripe had not retried that event by the latest check. Do not make another payment for this test. If the automatic retry does not arrive, replay the failed test-mode webhook after the fix, then confirm both inboxes. A sandbox success must never be represented as a real order.

For the next release, replace this section with the newest concise result; do not append another full historical diary.
