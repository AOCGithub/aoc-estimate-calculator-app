# Production test results

Status: operational release record
Latest release: 25 November 2026

Detailed historical test diaries were removed from the active tree to prevent obsolete behavior from being mistaken for current requirements. Git history retains earlier evidence.

## Current production release

- Commit: `ca76fe0` — `Apply simplified calculator rules and discovery checkout`
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

One later combined `npm run test:g2` invocation could not launch Chrome inside the restricted workspace (`spawn EPERM`); its backend, email and PDF portions passed, and the same browser handoff test had already passed in the approved browser environment. This was an execution-permission limitation, not an application assertion failure.

## Payment boundary

The deployed checkout remains Stripe test mode. No real charge, real paid-order confirmation or final G3 rehearsal-project integration was performed during release. A sandbox success must never be represented as a real order.

For the next release, replace this section with the newest concise result; do not append another full historical diary.
