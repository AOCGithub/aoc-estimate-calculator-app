# Always Open Commerce AI Commerce Estimator

Current working version: React migration, 19 October 2026. Start with `docs/DEVELOPER-HANDOFF.md` for the business rules and release constraints.

For a plain-language guide to requesting, testing, and publishing changes, see [Pricing and Form Maintenance](docs/PRICING-AND-FORM-MAINTENANCE.md).

The default page is the seven-section estimate journey. Previous interfaces are retained under `legacy/` for reconciliation and are excluded from production builds.

## Project layout

- `src/` — active React application, components, state hook, and UI helpers.
- `public/` — browser calculation runtime, approved generated rules, contracts, and styles.
- `worker/` — API routes and deployment Worker entry point.
- `scripts/` — rule compilation, Worker packaging, and artifact validation.
- `tests/` — maintained React/Worker checks plus clearly documented historical tests.
- `data/` — versioned workbook and regression snapshots; never served publicly.
- `docs/` — implementation handoff, release constraints, and deployment instructions.
- `api/` — Vercel Function adapters for the existing calculator and organizer contracts.
- `legacy/` — pre-React interfaces retained for reconciliation; excluded from builds.
- `dist/` — generated output from `npm run build:worker`.

The user interface is a React 19 application built with Vite 6. Use Node 20 or newer.

```sh
npm install
npm run dev
```

The local organizer is the default and requires no external API. It conservatively prefills facts
that are explicitly stated and leaves pricing-sensitive answers for review. OpenAI organization is
an optional enhancement. To enable it locally, copy `.env.example` to `.env.local`, set
`OPENAI_API_KEY`, and change `AOC_AI_ORGANIZER_ENABLED=true`. Vite then serves
`/api/journey/analyze` through the same OpenAI Responses API, structured-output contract, and
`AOC_INTAKE_MODEL` setting used by the packaged Worker. Keep the key server-side; never use a
`VITE_`-prefixed secret. Any API error, timeout, unreadable response, or missing configuration
automatically falls back to local organization without blocking the prospect.

Create the browser build and package the API Worker with embedded assets:

```sh
npm run build:worker
```

Run the deterministic model and packaged Worker checks:

```sh
npm test
```

For a Git-connected Vercel staging deployment, follow `docs/VERCEL-DEPLOYMENT.md`. The committed `vercel.json` uses the Vite build in `dist/client` and deploys the existing server calculation and organizer behavior as Vercel Functions.

The pricing model and generated field banks remain framework-independent files under `public/` so the existing Node parity checks and Worker can use the same source of truth:

```sh
node scripts/compile-approved.cjs
node tests/test-journey.cjs
node tests/test-journey-worker.cjs
```

Completed estimates are posted to `/api/journey/calculate`. Both Vite development and the packaged
Worker use `public/journey-calculation.js` to validate allowed fields, derive management ownership,
and run the deterministic pricing engine on the server. If that endpoint is unavailable, the browser
shows an explicitly labeled local preview; it is not presented as server-verified.

`npm run build:worker` creates the Vite client in `dist/client` and packages it into the Worker at `dist/server/index.js`. The current React interface uses `/api/journey/analyze` and `/api/journey/calculate`. Historical intake and transcription routes remain packaged for reconciliation, but voice remains disabled in the current UI as required by the implementation plan. `.openai/hosting.json` retains the existing Site identity. Secrets belong only in secure runtime environment configuration, never committed files.

The Sheet snapshot is internal configuration input, not an automatic live Sheet connection. Refresh it from the workbook, reconcile the mapping, version it, run parity tests and deploy. Do not manually edit compiled JavaScript and the Sheet independently. The new test scripts cover the current journey; older tests target historical DOM structures and may require migration.

The deployed preview is public and has no client qualification gate. Do not enter private client records. Production still needs authenticated qualification, configuration release control, persistence/purchase authorization, and deployment browser/mobile testing. Build and workflow monthly prices are draft calibration; monthly agent upkeep remains unpriced. The prior flat agent upkeep surcharge is withdrawn.
"# aoc-estimator-app" 
