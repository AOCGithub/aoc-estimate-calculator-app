# Vercel deployment

Status: operational
Reviewed: 25 November 2026

Production: <https://estimate.alwaysopencommerce.com/>
Fallback: <https://aoc-estimate-calculator.vercel.app/>
Production branch: `main`

Vercel builds the Vite client into `dist/client` and deploys the Node functions under `api/`. The repository’s `vercel.json` defines the build/output contract and security headers.

## Before deployment

1. Confirm [Current system](CURRENT-SYSTEM.md) and the canonical rules agree.
2. Regenerate rules after an approved pricing/category change.
3. Run the affected test suites and production build.
4. Confirm no secrets, environment files, generated `dist/` files or test artifacts are staged.
5. Keep Stripe in test mode unless a separately reviewed live-payment implementation has been approved. The current server rejects live-mode payment events.

## Environment groups

Values are private and must not be copied into documentation.

- Access/session/reCAPTCHA: paired browser/server gate flags, session secret and matching reCAPTCHA keys/version.
- Database: Supabase/Postgres server credentials and profile/record flags.
- AI/voice: server-only provider key and organizer/voice/correction flags.
- Stripe sandbox: test secret, webhook secret, exact hosted origin and paired browser/server sandbox flags.
- Payment email: enabled flag, approved sender/provider configuration and provider secret.

Never use `VITE_` for a secret. A browser/server feature pair must be changed together and followed by a redeploy.

## Publish

```sh
git push origin HEAD:main
```

Wait until the new Production deployment reports **Ready** and the custom-domain alias is attached.

## Required smoke test

1. Load the custom domain and complete a synthetic entry.
2. Confirm the six active categories and five Coming Soon categories.
3. Calculate representative Simple, Moderate and Complex routes without process-step availability errors.
4. Confirm the output rules version equals `simplified-2026-11-25-v7-paid-advertising-coming-soon`.
5. Confirm the discovery fee is 15% and the payment UI appears for every active category when the sandbox feature is enabled.
6. Confirm Paid Advertising cannot be calculated.
7. Confirm unauthenticated payment/status and protected calculation paths reject unauthorized requests.
8. If payment/email code changed, use a synthetic sandbox purchase only; verify one intake, separate Stripe receipt/AOC email, PDF, retry behavior and no confirmation for failed/unpaid/duplicate events.

Record one concise result in [Production test results](PRODUCTION-TEST-RESULTS.md). Do not copy old release narratives into current guides.
