# Tests

Run `npm test` from the repository root. It builds the current React client and retained Worker, then runs the maintained local regression suite. It uses synthetic providers and isolated or mocked persistence, with no paid AI requests or production database writes. Chromium must be installed for browser checks.

## Layout

| Folder | Purpose |
| --- | --- |
| `unit/` | Pricing, document rules, access, profile protocol and description/voice logic |
| `integration/` | Worker, Vercel API exports and local HTTP adapter |
| `browser/` | Current React desktop/mobile journeys |
| `fixtures/` | Shared synthetic quotes and scenarios |
| `database/` | Explicit real-Supabase and deployed saving checks |
| `provider/` | Explicit paid AI/voice checks |
| `legacy/` | Previous interfaces and pre-gate production AI checks; excluded from `npm test` |

The current pricing checks preserve historical arithmetic as explicit regressions. They also verify the fixed-project overlay, audit/credit boundaries, optional quoted support, existing agreements, changed/cleared answers, 12-area ROI eligibility, 10,000 exact-cent payment splits and unknown-price handling. Fixture amounts are synthetic, not approved customer prices.

## Focused local checks

Build first with `npm run build:worker` when running focused checks against generated assets.

- `npm run test:domain`: calculation and document-rule checks.
- `npm run test:access`: entry, session and estimate-record checks.
- `npm run test:recaptcha`: v2/v3 server verification, version/hostname/expiry/replay guards, v3 action/score checks, no writes before verification, profile bypass protection and desktop/mobile checkbox/entry/retry/saving journeys with synthetic providers.
- `npm run test:profiles`: offline profile protocol and mocked production storage.
- `npm run test:access-ui`: entry/consent journeys, deferred calculator loading, download failures/reload, logout privacy and re-entry.
- `npm run test:ui`: calculator journeys, editable/relevant fields, validation, calculation, stale results, download and desktop/mobile layouts.
- `npm run test:live-voice`: voice/correction logic and simulated browser journeys, including Undo, punctuation, ambiguous words, silence, device errors and delayed responses.
- `npm run test:worker`, `test:intake`, `test:vercel`, `test:local-api`: server/deployment adapter and non-object JSON checks. Local-API checks also verify deferred data loading and private-file protection using an isolated Vite server with synthetic files; real environment files are never probed.
- `npm run test:local-pricing`: isolated sample support-pricing checks; never publishes sample prices.

For the additional profile/company-fact browser journeys, start `npm run dev:profiles` and run `npm run test:profiles:ui` in another terminal. Set `AOC_PROFILE_TEST_URL` to use another local port. `npm run test:ui:capture` saves screenshots in ignored `artifacts/`.

## Database and deployed checks

These are separate opt-in checks. They require authorized server credentials and may write synthetic rows, which the tests remove.

- `npm run test:profiles:database`: actual Supabase persistence, ownership, concurrency, expiry and deletion.
- `npm run test:profiles:cloud-ui`: production-built React with local Node handlers and real Supabase, including independent saving choices. Build first; no paid AI.
- `npm run test:intake-access:db`: local submit-and-enter database journey. Adding `-- --live` targets the AOC domain and makes one paid AI-prefill request.
- `npm run test:manual-access:db`: the retained review-mode journey, separate from the current intake-only mode.
- `npm run test:gate-saving:live`: deployed consent and estimate-record checks.

See [profiles](../docs/features/OPTIONAL-CLIENT-PROFILES.md) and [entry/saved-data maintenance](../docs/GATE-AND-SAVED-DATA-MAINTENANCE.md).

## Paid provider checks

These require an explicit `--live`; they are not part of `npm test`. Use synthetic text/audio only and keep recordings/reports in ignored `artifacts/`.

```sh
node --env-file=.env.local tests/provider/test-commercial-ai.mjs --live
node --env-file=.env.local tests/unit/test-description-correction.mjs --live
node --env-file=.env.local tests/provider/test-live-voice-provider.mjs --live --audio path/to/synthetic.wav --expect-first Testing
```

The commercial check makes two local API/provider requests. Correction supports `--quality` for two punctuation/uncertainty checks. Voice supports `--expect-silence` and local `--delay low|medium|high` comparisons. It uses synthetic audio, not the physical microphone, and starts playback after **Listening**.

For explicitly authorized deployed voice checks, the voice script supports `--production`, `--mobile` and `--check-correction` (one additional paid correction request). It submits synthetic entry details with database saving off; the deployed server supplies its key. See [live voice](../docs/features/LIVE-VOICE-INPUT.md). Browser viewport checks do not replace physical-device/microphone checks; compare noisy transcripts with the actual recording before claiming accuracy.

`legacy/test-production-ai.cjs` predates gated entry and is retained for historical reference. Use the current gated checks for release verification.
