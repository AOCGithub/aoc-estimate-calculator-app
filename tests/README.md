# Tests

The maintained React-era regression suite is:

- `test-journey.cjs` — retained 18 October arithmetic regression, field banks, and extraction validation. Historical arithmetic is explicitly tested with the current commercial overlay disabled; it is not current pricing sign-off.
- `test-commercial.cjs` — active 21 October fixed-project/monthly-program rules, audit-credit boundaries and reuse, quoted support-source protection, existing agreements, applicable provider savings, unknowns, benefit timing, and changed/cleared answers.
- `test-journey-worker.cjs` — packaged assets, API guards, and mocked AI extraction.
- `test-voice-server.cjs` — retained intake/transcription API contract, provider error handling, request limits, and same-origin guards. Voice remains disabled in the current React interface.
- `test-react-ui.cjs` — real Chromium journey, conditional form behavior, manual scope preservation, local/server calculation paths, validation rejection, fixture totals, stale results, protected area changes, and mobile overflow.

`npm test` builds the current client and packaged Worker before running tests that inspect generated artifacts.

The browser suite includes fixed-project and monthly-program desktop/mobile journeys, conditional agreement/quote fields, plan switching/removal and stale results. Fixture quote amounts and agreed hours/rates are synthetic test data, not newly approved prices.

For two opt-in live-provider checks against the current local API code, run `node --env-file=.env.local tests/test-commercial-ai.mjs --live`. This uses synthetic text and saves `artifacts/commercial-ai-results.json`. It does not deploy or certify the live website. Never commit the key or local artifact.

Production AI acceptance checks are separate from `npm test`. Run `node tests/test-production-ai.cjs --live` explicitly; this uses paid AI requests with synthetic data against the AOC test domain. Use `--case "Incomplete description"` to repeat only that scenario. Results are saved under the Git-ignored `artifacts/` directory. Browser-simulated errors consume no AI credits. Physical-device testing remains separate from the Chromium viewport checks.

The remaining tests cover historical calculator versions retained for reconciliation. They are not part of `npm test` because their previous `dist/` UI is no longer the active React application.
