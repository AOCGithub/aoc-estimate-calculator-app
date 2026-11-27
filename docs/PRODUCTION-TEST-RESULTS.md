# Production test results

Status: operational release record
Latest release: 27 November 2026

Detailed historical test diaries were removed from the active tree to prevent obsolete behavior from being mistaken for current requirements. Git history retains earlier evidence.

## Current production release

- Application release: `5d8e5f2` — `Use Template V6 for accepted C10 PDFs`
- Branch: `main`
- Vercel deployment: Ready
- Production URL: <https://estimate.alwaysopencommerce.com/>
- Rules version: `simplified-2026-11-25-v7-paid-advertising-coming-soon`

Verified on the public deployment:

- Vercel deployment `dpl_AFwaMQfqJEqg1d8E8vRNZ68TPKHz` completed Ready and is aliased to the production URL.
- Homepage and public access-status endpoint returned HTTP 200. An unauthenticated payment-status request returned HTTP 401 as expected.
- C10 now uses the actual client-facing Template V6 page artwork, populated with each accepted order's saved facts, scope, pricing and terms. The blank source page and AOC-only notes page are excluded.
- C10 PDF tests and visual inspection confirm the five-page output, filled order data, preserved table borders, no unresolved placeholders and safe overflow pages.
- The full `npm test` suite passed before deployment, including the production build and payment/email integration tests.
- Production checks were read-only. No sandbox payment was made and no customer or support email was sent.

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

The deployed checkout remains Stripe test mode. G3 C10 acceptance, persistence and post-payment attachment delivery are deployed. No charge or customer email was generated during release verification; an authorized sandbox transaction is still required to confirm actual inbox receipt. A sandbox success must never be represented as a real order.

For the next release, replace this section with the newest concise result; do not append another full historical diary.
