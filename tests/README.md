# Tests

The maintained React-era regression suite is:

- `test-journey.cjs` — retained 18 October arithmetic regression, field banks, and extraction validation. Historical arithmetic is explicitly tested with the current commercial overlay disabled; it is not current pricing sign-off.
- `test-commercial.cjs` — active 21 October fixed-project/monthly-program rules, audit-credit boundaries and reuse, quoted support-source protection, existing agreements, applicable provider savings, unknowns, benefit timing, and changed/cleared answers.
- `test-journey-worker.cjs` — packaged assets, API guards, and mocked AI extraction.
- `test-voice-server.cjs` — retained intake/transcription API contract, provider error handling, request limits, and same-origin guards. Voice remains disabled in the current React interface.
- `test-react-ui.cjs` — real Chromium journey, conditional form behavior, manual scope preservation, local/server calculation paths, validation rejection, fixture totals, stale results, protected area changes, and mobile overflow.

`npm test` builds the current client and packaged Worker before running tests that inspect generated artifacts.

It also runs `test-local-api.mjs` against a real local HTTP listener with synthetic providers, covering the thin Vite adapter and shared Node handlers without paid AI calls. `test-vercel-api.mjs` checks the Web Request/Response export format of every API entry. Real Supabase/browser journeys remain explicit opt-in tests (`test:intake-access:db` and `test:manual-access:db`); the latter accepts a localhost-only `AOC_TEST_BASE_URL` for an isolated review-mode preview.

For the deployed submit-and-enter flow, `npm run test:intake-access:db -- --live` explicitly tests the AOC production domain. It saves and removes only its synthetic database rows and makes one paid advertising AI-prefill request in total. Omitting `--live` keeps the test on localhost with no paid AI calls. The older `test-production-ai.cjs` suite below predates gated entry; use the gated smoke test for this release.

The browser suite includes fixed-project and monthly-program desktop/mobile journeys, conditional agreement/quote fields, plan switching/removal and stale results. Fixture quote amounts and agreed hours/rates are synthetic test data, not newly approved prices.

For two opt-in live-provider checks against the current local API code, run `node --env-file=.env.local tests/test-commercial-ai.mjs --live`. This uses synthetic text and saves `artifacts/commercial-ai-results.json`. It does not deploy or certify the live website. Never commit the key or local artifact.

Production AI acceptance checks are separate from `npm test`. Run `node tests/test-production-ai.cjs --live` explicitly; this uses paid AI requests with synthetic data against the AOC test domain. Use `--case "Incomplete description"` to repeat only that scenario. Results are saved under the Git-ignored `artifacts/` directory. Browser-simulated errors consume no AI credits. Physical-device testing remains separate from the Chromium viewport checks.

The remaining tests cover historical calculator versions retained for reconciliation. They are not part of `npm test` because their previous `dist/` UI is no longer the active React application.
