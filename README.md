# Always Open Commerce Estimator

React calculator with editable, relevant questions, optional AI prefill and voice input, server-side estimates, and independent choices for remembering business details and saving estimates. Visitors enter five business details; verification and AOC approval are currently paused.

Start with the [AOC maintenance guide](docs/GATE-AND-SAVED-DATA-MAINTENANCE.md), [pricing/form instructions](docs/PRICING-AND-FORM-MAINTENANCE.md), or [documentation index](docs/README.md). Published checks are recorded in [Production Test Results](docs/PRODUCTION-TEST-RESULTS.md).

## Local development

Use Node 22.13 or newer (the offline profile adapter uses `node:sqlite`). Checks were run with Node 24.11.1.

```sh
npm ci
npm run dev:profiles
```

This opens the offline profile preview at `http://127.0.0.1:5174/`. Profiles use a private local SQLite file; these records are not copied to Supabase. Optional AI features depend on server environment settings. See [.env.example](.env.example) for configuration; keep keys server-side and never prefix secrets with `VITE_`.

`npm run dev` starts the entry form using the linked Vercel project's production server environment. It requires authorized Vercel CLI access, can use paid AI, and can save to Supabase when consent is selected. Use the offline preview for routine UI work. `npm run dev:profiles:database` is the explicit real-database profile preview.

```sh
npm test
```

This builds the app and retained Worker, then runs local pricing, access, profile, API and Chromium checks with synthetic providers. It does not call paid AI or write to production Supabase. See [tests](tests/README.md) for focused commands and separate database/provider checks.

## Project layout

| Folder | Responsibility |
| --- | --- |
| `src/features/access/` | Business-details entry and access state |
| `src/features/calculator/` | Seven sections, field controls, estimate display and state |
| `src/features/description/` | Live dictation and description correction |
| `src/features/profiles/` | Optional profile consent, review and reuse |
| `src/components/` | Shared branding, icons, dialogs and visuals |
| `src/lib/`, `src/styles/` | Shared browser helpers and styles |
| `api/` | Stable public Vercel API routes |
| `server/` | Shared Node handlers; helpers grouped into access, calculator, description and profiles |
| `shared/` | Profile rules shared by browser and server |
| `public/` | Public assets and framework-independent pricing runtime |
| `data/` | Private versioned pricing/workbook snapshots |
| `supabase/migrations/` | Database schema migrations |
| `scripts/` | Build, development, database and deployment commands |
| `tests/` | Unit, integration, browser, database, provider and historical checks |
| `docs/` | Current guides, feature references and historical reports |
| `worker/` | Retained Worker deployment adapter |
| `legacy/` | Historical interfaces, excluded from the active app build |

`dist/` is generated output, `artifacts/` contains local test reports/screenshots, and `node_modules/` contains installed dependencies. These are ignored by Git. Local environment files and `.vercel/` are private configuration, also ignored.

Keep feature-specific components and hooks together. Put components in `src/components/` only when they are shared across features. Use direct imports; no barrel files or extra abstraction layers are required.

## Pricing and builds

The active rules are `2026-10-29-fixed-project-v1`: fixed-price builds, included reusable training, separately quoted live training and optional management. Monthly build programs are deferred; unspecified support prices remain unknown.

The [compiler](scripts/build/compile-approved.cjs) combines the retained 18 October workbook snapshot with the current [commercial rules](data/commercial-rules-20261029.json). Pricing-sheet edits do not automatically change the website. Follow the [maintenance instructions](docs/PRICING-AND-FORM-MAINTENANCE.md), regenerate the approved files and run tests.

```sh
node scripts/build/compile-approved.cjs
npm test
```

`public/` retains stable runtime filenames because the browser, Node handlers and Worker share them. Do not move them into a feature folder or edit generated pricing independently. `/api/journey/calculate` validates answers and calculates server-side; an unavailable endpoint is shown as a labelled local preview.

## Deployment

Vercel uses `npm run build`, `dist/client` and the existing `api/` routes. `npm run build:worker` additionally packages the retained Worker in `dist/server/index.js`. Build output should not be edited by hand.

Follow [Vercel deployment](docs/VERCEL-DEPLOYMENT.md). Push tested changes to `main` only when ready to publish, then verify the deployed version. Keep AI/database keys in private server settings. The AOC website link/button remains deferred.
