# Code and performance review — 11 November 2026

Scope: requested local review and targeted refactoring. Not deployed. The existing uncommitted maintenance-note edit was preserved.

## Findings and changes

- Entry previously downloaded the complete calculator plus five rule scripts, including the 380 KB approved question bank. `App.jsx` now handles entry; `features/calculator/Calculator.jsx` loads with the same approved rules only when the calculator opens. Existing sessions and ungated previews still work. Failed downloads show a reload option.
- All Node API routes previously initialized calculator, question and historical intake data. Handlers now import calculation, organizer and voice dependencies when those functions are used, after the existing access checks. Node caches successful module imports. API URLs and retained Worker/intake functionality are preserved.
- Optional-question filtering rebuilt shared-field sets and candidate arrays on repeated renders. Those static results are now reused per approved business area. Calculator actions also keep stable references between unrelated renders, avoiding unnecessary field-helper setup.
- Removed an unused icon list. A syntax/import review covered 85 application/support modules and found no unused imports or identical source files after cleanup. This does not prove the absence of every semantic duplicate.
- Calculator unmount now removes its in-memory inspection bridge, preventing the previous estimate from remaining reachable after logout.

No runtime dependency, pricing coefficient, business question, database schema, consent choice or new product feature was added. Pricing and approved generated rule files were not changed. Existing endpoint wrappers and historical adapters have different deployment/compatibility roles; combining or deleting them would risk behavior for little measured benefit.

## Structure assessment

The current structure is appropriate for the app's scope. Feature-specific UI/state stays under `src/features/`; shared UI, shared browser/server profile rules, route wrappers, server helpers, scripts and historical sources have distinct locations. The field helpers reduce repeated labels/validation without introducing a generic form framework. No new runtime dependencies or extra state-management layers were introduced.

An explicit import/require graph check covered 94 JavaScript modules, including public runtime assets, and found no circular import chains. The approved browser rules still use compatibility globals; their load order is tested and their public filenames support the Node/Worker runtimes. Endpoint wrappers and retained adapters serve actual routing/compatibility needs.

Maintainability watchpoints are `useEstimator.js` (728 lines: state transitions plus local prefill heuristics) and `server/api-handlers.mjs` (451 lines: shared handlers plus access/session helpers). Their responsibilities are understandable today; extract focused logic if future changes make them harder to maintain. The requested Aurora visual also contains substantial shader/graphics code. Size alone is not a reason to replace these with more abstraction layers.

No further structural rewrite is recommended from this check. This follow-up changed documentation only; the already-passed functional checks remain applicable.

## Local measurements

Five fresh-browser samples per version: 390px viewport, cold cache, 4× CPU slowdown, 80ms delay per JavaScript/CSS response, gzip and reduced motion.

| Entry-page metric | Before | After |
| --- | ---: | ---: |
| Initial JavaScript, decoded | 780,879 bytes | 268,779 bytes |
| Initial JavaScript, gzip | 179,063 bytes | 84,756 bytes |
| Median first contentful paint | 472ms | 388ms |
| Median form-ready time | 715ms | 689ms |

Initial JavaScript fell 65.6% before compression and 52.7% with gzip. Calculator code/rules still download when needed; this is a reduction in initial work, not removal of functionality.

Five fresh local Node processes per version: median API-module import time was 40.2ms before and 13.8ms after. Eager CommonJS source loading fell from 554,575 to 19,854 bytes; the access path no longer initializes the question bank or historical intake catalog.

These are controlled local measurements, not production speed guarantees. AI response latency and external CAPTCHA/database network time were not optimized or measured by this refactor. Local raw reports are under ignored `artifacts/`.

## Verification

- Deferred entry, dependency ordering, one-time rule loading, failed script/chunk recovery, empty re-entry and logout privacy passed at desktop/mobile widths under the production CSP.
- A fresh-process API check verifies that access/rejected requests do not initialize calculator data, then confirms a valid calculation still produces the expected result without loading the historical intake catalog.
- Full `npm test` passed: document/pricing rules, 10,000 exact-cent splits, 144 independent quote/ROI cases, form validation, Node/Worker/API adapters, v2/v3 CAPTCHA, synthetic AI/voice contracts, complete desktop/mobile calculator journeys and artifact validation.
- Additional `npm run test:profiles:ui` passed against the offline preview: unchecked consent, review/reuse, current/cleared answers, identity separation, selected/full deletion, calculation and stale-result handling at 1440px and 390px.
- Replaced an obsolete check for a commercial-script tag in the HTML with a browser check that commercial rules initialize before the deferred calculator renders. Pricing assertions were preserved.

## Follow-up comparison with production

- Confirmed production is still Ready at commit `4d841dd3fdcc7e4d5e9b522e9c7f103295e56093`; the refactor remains local. Nine deployed pricing/calculation/validation assets match the local versions after line-ending normalization.
- Downloaded the actual deployed browser bundle and replayed the same complete desktop/mobile calculator tests against it and the refactored build, using synthetic local API responses. Both passed: relevant/editable fields, prefill fallback, scope add/remove, validation, server/local results, changed/cleared answers, reset, download and responsive layouts.
- Compared original and refactored Node handlers directly in 138 cases. Responses, statuses and simulated provider request bodies matched across all 12 areas, workflow/agent estimates, ROI, missing/invalid/cleared inputs, access/origin guards, AI facts/unknowns/approval restrictions, voice setup and spelling checks.
- The local production build passed actual Supabase desktop/mobile profile/company-fact journeys and all four independent remembering/recording choices. Cleanup removed four synthetic submissions, four linked estimates and the tests' capability-owned profiles; existing client records were preserved.
- On the actual live entry page, required-field checks, unchecked saving defaults, visible v2 CAPTCHA, rejection when unchecked, preserved input and overflow checks passed at 1440px, 390px and 320px. Those live-page checks made no submissions.

No unintended functional differences were found in these checks. Normal localhost previews still disable CAPTCHA; v2 behavior remains covered by the configured synthetic-provider tests and live entry inspection. AI/voice providers were simulated, not charged or tested with a physical microphone. This follow-up does not claim a new complete live journey through Google's human challenge.

## Fresh overall regression and fixes

The requested overall check found two items beyond the earlier normal-flow comparisons:

- The active organizer and retained intake handlers could throw an unhandled error for JSON `null`. Shared Node request parsing now rejects non-object JSON with HTTP 400. Matching guards were added to both Worker analysis handlers. New Node/Worker cases cover null, arrays, numbers, booleans and strings; the tests reproduced the exception before the fix and passed afterward.
- `npm audit` reported the moderate [Vite 6.4.4 development-server advisory](https://github.com/vitejs/vite/security/advisories/GHSA-8g5g-mxqh-grgj). Updated only Vite to 6.4.6 and raised the package minimum accordingly. The final audit reports zero known advisories. Synthetic private-file probes cover direct/raw/import/inline requests in an isolated server; no real environment files were requested. Those probes are coverage, not a claim that every advisory exploit was reproduced.

Fresh verification after the fixes passed:

- Full `npm test`, including the new input-shape regressions and private-file checks, pricing/document rules, access/profiles, CAPTCHA, simulated AI/voice, desktop/mobile journeys and Worker artifact validation.
- Syntax/import checks for 140 JavaScript modules: no syntax failures or unused imports.
- Actual Supabase persistence/ownership/concurrency/expiry/deletion tests, plus the production-build browser/profile/company-fact journeys and all eight consent combinations by viewport. Synthetic profiles were deleted; four synthetic submissions and four estimates from the saving-choice run were removed.
- Offline profile/company-fact browser checks through Vite 6.4.6 and all 138 established normal API comparisons with the deployed version. Non-object JSON is the intentional new validation behavior.
- The Vite patch produced byte-identical browser assets. Pricing data, generated rules, database schema and production settings were unchanged.

The older normal preview was restarted using the current launcher and Vite 6.4.6 at `http://localhost:5173/`. A no-save smoke check passed for entry, all 12 areas, the expected server quote, logout and clearing private in-memory state. The temporary port 5184 test preview was stopped.

No paid AI calls, GitHub push, deployment, schema changes or production-setting changes were made. The Supabase follow-up used synthetic records and removed them. Physical devices/microphones, fresh paid-provider acceptance and a complete live human-CAPTCHA journey were not included. Passing these checks does not prove the absence of all possible bugs.
