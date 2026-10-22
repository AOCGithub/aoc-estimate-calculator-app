# Tests

The maintained React-era regression suite is:

- `test-journey.cjs` — deterministic pricing, ROI, field banks, and validation.
- `test-journey-worker.cjs` — packaged assets, API guards, and mocked AI extraction.
- `test-voice-server.cjs` — retained intake/transcription API contract, provider error handling, request limits, and same-origin guards. Voice remains disabled in the current React interface.
- `test-react-ui.cjs` — real Chromium journey, conditional form behavior, manual scope preservation, local/server calculation paths, validation rejection, fixture totals, stale results, protected area changes, and mobile overflow.

`npm test` builds the current client and packaged Worker before running tests that inspect generated artifacts.

Production AI acceptance checks are separate from `npm test`. Run `node tests/test-production-ai.cjs --live` explicitly; this uses paid AI requests with synthetic data against the AOC test domain. Use `--case "Incomplete description"` to repeat only that scenario. Results are saved under the Git-ignored `artifacts/` directory. Browser-simulated errors consume no AI credits. Physical-device testing remains separate from the Chromium viewport checks.

The remaining tests cover historical calculator versions retained for reconciliation. They are not part of `npm test` because their previous `dist/` UI is no longer the active React application.
