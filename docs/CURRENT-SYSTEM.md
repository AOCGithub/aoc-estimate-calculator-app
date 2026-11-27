# Current system

Status: authoritative
Reviewed: 27 November 2026
Rules version: `simplified-2026-11-25-v7-paid-advertising-coming-soon`

This is the concise source of truth for the estimator’s current product behavior. Resolve conflicts using [Documentation governance](DOCUMENTATION-GOVERNANCE.md).

## Current journey

1. A visitor enters the five required business details and completes reCAPTCHA.
2. Saving business details/estimates and remembering a profile are independent, optional choices that start unchecked.
3. The visitor describes the work, reviews editable extracted facts and completes the relevant questions.
4. The server validates the selected route and calculates the estimate from the current rules.
5. Every supported category can continue to the shared **AI Commerce Discovery & Implementation Plan** checkout flow when the estimate is complete.

Email ownership verification and mandatory AOC approval remain paused. The current entry flow is not proof of verified identity.

## Supported business areas

Active:

- Customer service & returns
- Finance & billing
- Orders, inventory & fulfillment
- Sales & customer relationships
- People & HR
- Back-office administration

Coming soon:

- CRO / storefront and conversion
- Content Machine / social publishing
- SEO / GEO
- Email / lifecycle
- Paid advertising

“Another area / several areas / not sure” remains a routing choice, not another priced category. Coming-soon areas must not be made calculable by old documentation, fixtures or previously implemented logic.

## Current commercial behavior

- Core bands: Simple `$1,500`, Moderate `$3,500`, Complex `$6,000`.
- Data preparation: Clean `$0`; existing/partial `$1,000`; limited/unknown `$2,000`.
- Additional connected apps: `$500` each; no apps are included by default.
- Review workflow: `$500`; control requirement: `$1,500`.
- Rollout and department amounts use the current versioned rules.
- Estimate range: 80%–125%, rounded to `$100`.
- The paid discovery fee is 15% of the complete one-time project estimate.
- Launch Support is a proposed `$500` mockup item, not an approved fee or finalized service.
- Future operating costs are excluded from ROI unless explicitly supplied by the client.
- Make credit and budget figures are planning estimates, not Make tariffs; external AI-provider charges are separate.

The application must leave unknown or unapproved prices unavailable. It must not revive older monthly-build packages, fixed audit examples or superseded advertising logic.

## Payment and email status

- Stripe is configured as a sandbox/test handoff. Server code rejects live-mode checkout and events.
- A successful sandbox payment creates one rehearsal intake; duplicate events remain idempotent.
- Failed, expired, unpaid, mismatched or duplicate events cannot create a new paid confirmation.
- The Stripe receipt is separate from the AOC next-step email.
- Checkout records affirmative acceptance of the exact C10 reference/version before opening Stripe.
- After verified payment, the email carries separate accepted-C10 and estimate PDF attachments; the Stripe receipt remains a separate link.
- The accepted C10 and saved estimate use immutable purchase data.
- Final sender/recipient authorization, live wording and the external rehearsal-project destination remain dependency decisions owned by Vianca/Diana. Sandbox behavior does not authorize a real paid-order email.

## Deployment

Production: <https://estimate.alwaysopencommerce.com/>
Production branch: `main`
Current deployed release commit: `ca76fe0`

Vercel deploys `main` automatically. A release is complete only after Vercel reports **Ready** and the public `approved-pricing.js` exposes the intended rules version.

## Canonical implementation

- Editable rules: `data/simplified-calculator-rules.json`
- Compiler: `scripts/build/compile-approved.cjs`
- Generated browser rules: `public/approved-pricing.js`, `public/approved-bank.js`
- Shared calculation runtime: `public/journey-engine.js`
- Server calculation entry: `/api/journey/calculate`
- Payment implementation: `server/payments/`, `api/payments/`, `src/features/payments/`

Generated rule files must not be edited as independent sources.
