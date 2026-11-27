# Production test results

Status: operational release record
Latest release: 27 November 2026

Detailed historical test diaries were removed from the active tree to prevent obsolete behavior from being mistaken for current requirements. Git history retains earlier evidence.

## Current production release

- Application release: `cb8185b` — `Add explicit local sandbox email delivery`
- Branch: `main`
- Vercel deployment: Ready
- Production URL: <https://estimate.alwaysopencommerce.com/>
- Rules version: `simplified-2026-11-25-v7-paid-advertising-coming-soon`

Verified on the public deployment:

- Home and generated pricing assets returned HTTP 200.
- The public rules asset contained the exact current version.
- Six active-area IDs matched the current rules.
- Paid Advertising was listed under Coming Soon.
- The production JavaScript included the discovery-to-Stripe checkout UI.
- The private production payment schema accepted the G3 `accepted_order` migration and passed its access checks.
- Checkout and email code include exact C10 acceptance plus separate accepted-C10 and estimate PDF attachments.
- An unauthenticated payment-status request returned 401.
- Required Stripe sandbox and payment-email environment variable names were present in Production; their values were not displayed.

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
