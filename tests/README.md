# Tests

Status: operational
Reviewed: 25 November 2026

`npm test` builds the current client/Worker and runs maintained local regressions with synthetic or mocked providers. Browser checks require Chrome/Chromium permission. Opt-in database/provider suites are separate because they may write synthetic rows or incur provider usage.

## Current release contract

Tests must follow the current rules version, not preserve superseded behavior as expected output:

- Six active areas calculate; CRO, content/social, SEO/GEO, email/lifecycle and Paid Advertising are Coming Soon.
- Route-specific process steps must be compatible with the selected area.
- The shared discovery fee is 15% of the complete one-time project estimate.
- Every active category uses the same payment path.
- Stripe remains test mode; live, failed, unpaid, mismatched and duplicate events cannot create a new paid confirmation.
- Unknown and proposed amounts remain visibly unavailable/proposed.

Historical fixtures may test migration or compatibility, but cannot override this contract. See [documentation governance](../docs/DOCUMENTATION-GOVERNANCE.md).

## Suites

| Command | Purpose |
| --- | --- |
| `npm run test:domain` | Current rules, calculations, route contracts and prefill |
| `npm run test:ui` | Desktop/mobile calculator and result journeys |
| `npm run test:g2` | Stripe sandbox, email, PDF, idempotency and payment UI |
| `npm run test:access` | Entry, sessions, consent and estimate records |
| `npm run test:profiles` | Local and mocked production profile protocol |
| `npm run test:recaptcha` | v2/v3 verification and browser journeys |
| `npm run test:live-voice` | Voice/correction logic and simulated browser behavior |
| `npm run test:worker` | Packaged Worker journey |
| `npm run test:intake` | Voice/intake server contracts |
| `npm run test:vercel` | Vercel calculation/API adapter |
| `npm run test:local-api` | Local adapter, deferred loading and private-file protection |
| `npm run test:local-pricing` | Isolated sample-pricing regression only |

Build first with `npm run build:worker` when a focused test depends on generated assets.

## Opt-in external checks

- `npm run test:profiles:database`
- `npm run test:profiles:cloud-ui`
- `npm run test:intake-access:db`
- `npm run test:manual-access:db`
- `npm run test:gate-saving:live`

These require authorized credentials and can write synthetic rows that the test removes. Paid provider scripts require an explicit `--live`; use synthetic text/audio and ignored `artifacts/`. Never use real payment-card data or private customer data in tests.

For a production release, record one concise result in [Production test results](../docs/PRODUCTION-TEST-RESULTS.md), not a duplicate diary in multiple feature guides.
