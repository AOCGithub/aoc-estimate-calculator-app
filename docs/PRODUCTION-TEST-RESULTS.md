# Production test results

Status: operational release record
Latest release: 27 November 2026

Detailed historical test diaries were removed from the active tree to prevent obsolete behavior from being mistaken for current requirements. Git history retains earlier evidence.

## Current production release

- Application release: `1c4e125` — `Align client C10 with Template V6`
- Branch: `main`
- Vercel deployment: Ready
- Production URL: <https://estimate.alwaysopencommerce.com/>
- Rules version: `simplified-2026-11-25-v7-paid-advertising-coming-soon`

Verified on the public deployment:

- Vercel deployment `dpl_FLhoLQxS1V1unu7ei3QELarvfmtH` completed Ready and is aliased to the production URL.
- Homepage and public access-status endpoint returned HTTP 200. An unauthenticated payment-status request returned HTTP 401 as expected.
- The public rules asset reports `simplified-2026-11-25-v7-paid-advertising-coming-soon`, six active categories, five Coming Soon categories, Paid Advertising as Coming Soon and a 15% discovery rate.
- C10 preserves the Template V6 client wording and five-page structure, fills the accepted order and payment placeholders, and excludes the blank page, AOC-only notes, working-draft wording, extra acceptance wording and additional appendix pages.
- C10 order version `C10-2026-11-27-v2`, service terms version `2026-11-27-template-v6-v3` and purchase agreement version `2026-11-27-template-v6-purchase-v3` identify newly accepted orders using this release.
- Production build, Stripe/payment integration, Microsoft email routing, purchase PDF, C10 PDF and checkout browser tests passed before deployment. All five client PDF pages were rendered and inspected for layout.
- Production smoke checks were read-only; no payment or email was initiated.

## Release checks

Passed locally before deployment:

- Production client build.
- Stripe backend: 27 payment/idempotency/failure/replay checks.
- Payment email routing and PDF generation tests.
- Stripe browser handoff in an approved browser run.
- The complete affected G2 suite, including headless Chrome, passed for the release candidate.

## Payment boundary

The deployed checkout remains Stripe test mode and rejects live-mode payment events. This release used read-only production checks and did not create another sandbox payment or send an email. A sandbox success must never be represented as a real order.

For the next release, replace this section with the newest concise result; do not append another full historical diary.
