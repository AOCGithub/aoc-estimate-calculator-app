# Always Open Commerce Estimator

Status: operational project overview

React/Vite estimator with server-validated calculations, editable AI-assisted intake, optional saving, profiles, voice input and a Stripe sandbox rehearsal flow.

Current rules: `simplified-2026-11-25-v7-paid-advertising-coming-soon`
Production: <https://estimate.alwaysopencommerce.com/>

Read [documentation governance](docs/DOCUMENTATION-GOVERNANCE.md) before applying requirements. The latest approved change supersedes older notes; [current system](docs/CURRENT-SYSTEM.md) is the concise product source of truth.

## Local development

Use Node 22.13 or newer. Node 24.11.1 is the currently verified development version.

```sh
npm ci
npm run dev:profiles
```

The offline profile preview runs at `http://127.0.0.1:5174/`. `npm run dev` and `npm run dev:g2` use the linked Vercel project’s production server environment and may use paid providers or persist explicitly consented records. Keep secrets in ignored environment files or Vercel; never expose them with a `VITE_` prefix.

```sh
npm test
```

See [tests](tests/README.md) for focused, database and provider checks.

## Current product boundary

Six business areas are active: customer service, finance, orders/fulfillment, sales/CRM, people/HR and back-office administration. CRO, content/social, SEO/GEO, email/lifecycle and Paid Advertising are Coming Soon.

All supported categories use the same estimate-to-**AI Commerce Discovery & Implementation Plan** path. The fee is 15% of the complete one-time project estimate. Stripe remains sandbox-only; no real charge or real paid-order email is authorized by this repository state.

## Project layout

| Folder            | Responsibility                                           |
| ----------------- | -------------------------------------------------------- |
| `src/`            | React UI, feature state and browser helpers              |
| `api/`, `server/` | Vercel routes and shared server handlers                 |
| `public/`         | Generated rules and framework-independent runtime assets |
| `data/`           | Versioned editable rules and retained snapshots          |
| `shared/`         | Browser/server contracts                                 |
| `supabase/`       | Additive database migrations                             |
| `scripts/`        | Build, local, database and deployment commands           |
| `tests/`          | Unit, integration, browser, database and provider checks |
| `docs/`           | Current authoritative and operational documentation       |
| `worker/`         | Retained Worker adapter                                  |
| `legacy/`         | Historical/compiler dependencies only                    |

Generated output (`dist/`), test artifacts, local environment files and `.vercel/` are ignored and must not be committed.

## Rules and builds

Edit `data/simplified-calculator-rules.json`, then regenerate and test:

```sh
node scripts/build/compile-approved.cjs
npm test
```

Do not edit generated rule files independently. Missing or unapproved amounts stay unavailable.

## Deployment

Push a verified commit to `main`; Vercel deploys automatically. Confirm **Ready**, verify the public rules version and run the release smoke test in [Vercel deployment](docs/VERCEL-DEPLOYMENT.md).
