# Production test results

Status: operational release record
Latest release: 27 November 2026

Detailed historical test diaries were removed from the active tree to prevent obsolete behavior from being mistaken for current requirements. Git history retains earlier evidence.

## Current production release

- Application release: `ab7c9f9` — `Align C10 PDF with Template V6 layout`
- Branch: `main`
- Vercel deployment: Ready
- Production URL: <https://estimate.alwaysopencommerce.com/>
- Rules version: `simplified-2026-11-25-v7-paid-advertising-coming-soon`

Verified on the public deployment:

- Homepage and public access-status endpoint returned HTTP 200 after this release.
- C10 now follows the linked Template V6 cover and section order while retaining the accepted order's saved wording, scope, price and terms.
- C10 PDF tests confirm internal notes and unresolved template placeholders are excluded.
- The full `npm test` suite passed before deployment.
- No sandbox payment was made and no customer or support email was sent during this deployment check.

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
