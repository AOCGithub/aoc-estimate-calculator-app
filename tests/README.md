# Tests

The maintained React-era regression suite is:

- `test-journey.cjs` — deterministic pricing, ROI, field banks, and validation.
- `test-journey-worker.cjs` — packaged assets, API guards, and mocked AI extraction.
- `test-voice-server.cjs` — retained intake/transcription API contract, provider error handling, request limits, and same-origin guards. Voice remains disabled in the current React interface.
- `test-react-ui.cjs` — real Chromium journey, fixture totals, stale results, and mobile overflow.

The remaining tests cover historical calculator versions retained for reconciliation. They are not part of `npm test` because their previous `dist/` UI is no longer the active React application.
