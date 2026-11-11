# Production Test Results

Date: 21 October 2026
Last updated: 11 November 2026
Scope: Production calculator, entry and optional saved-data verification

Pricing scope: reviewed 28-29 October fixed-price launch rules. Provisional build coefficients retain their documented status; unspecified support fees stay unknown. Earlier entries below are historical release evidence.

## Explicit zero implementation quote correction - 11 November 2026 (not deployed)

The current workbook (modified 5 November) allows nonnegative itemized quote components in `Audit & Project Quote!B20`. The source check reproduced an app-only positive-implementation restriction. Removed that restriction from shared request validation and project-total calculation; unknown components still prevent a complete quote. Added a short reminder to enter zero only when AOC explicitly quoted it.

- The regression failed before the fix and passed afterward. Coverage includes numeric/string zero, blank or missing preparation/implementation amounts, invalid/negative values, explicit zero totals and the existing excess-credit hold.
- Full `npm test` passed after the correction: pricing/document rules, 10,000 payment splits, 144 independent quote/ROI cases, access/profiles, saving choices, CAPTCHA, Node/Worker APIs, simulated AI/voice, desktop/mobile calculator journeys and artifact validation. Grounded AI-prefill validation preserves an explicit zero quote.
- The current-source audit passed 104 checks after the fix, including 96 scope/component combinations across all 12 areas. The two recorded workbook-test limitations remain separate: its draft-build investment/payback comparison and combined-versus-incremental fee reference. The app retains the written accepted-quote and incremental-ROI rules.
- Restarted the verified local preview to clear cached API code. Actual local entry and server calculations passed with both saving choices unchecked: numeric/text zero produce the quoted total, clearing restores an unknown quote and pending payback, and recording is skipped. No runtime errors or paid requests occurred.

No new prices, pricing coefficients, database schema, source-workbook edits, production data writes, push or deployment were made. Paid AI/voice providers were simulated in the regression suite.

## Completed-result availability labels - 11 November 2026 (not deployed)

Reproduced the misleading "Not yet calculated" label after a successful calculation with required scope answers but incomplete optional costs/quotes. The local UI now distinguishes missing details, AOC quotes and audit-credit details. The summary uses simpler wording, describes optional client inputs separately from missing details AOC must confirm, and links to the existing time/cost section. All supporting metrics and the full outstanding-details list remain expandable; errors stay open. No calculation rules, required inputs, downloadable data or prices changed.

- Desktop/mobile calculator regression and pricing/document-rule tests passed. The new browser checks cover missing optional inputs, navigation without changing answers/results, adding inputs, confirmed zero savings and clearing a previously answered input; independent known amounts remain displayed. Once time/cost inputs are complete, only the relevant AOC confirmation prompt remains.
- A manually mapped paid-advertising sample produced a provisional $7,400 build, $960 monthly capacity value, $50 ongoing costs and $910 net monthly benefit. Missing audit/project quotes and credit details correctly leave payment/payback figures unknown. This checks the calculator inputs, not a new real-provider AI-prefill call.
- Final full `npm test` passed after the readability update: production build, access/profiles and saving choices, CAPTCHA, pricing/document rules, Node/Worker APIs, simulated AI/voice, complete desktop/mobile journeys and artifact validation. Pricing/rule data and database schema are unchanged. No paid AI calls, production database writes, push or deployment were made for this correction.

## Overall local retest and fixes — 11 November 2026 (not deployed)

A fresh overall run found and fixed an unhandled non-object JSON input case in Node/Worker analysis handlers and patched the Vite development-server dependency to 6.4.6. Normal calculator behavior and pricing rules were preserved.

Passed after the fixes:

- Full `npm test`: build, input validation, access/profiles, v2/v3 CAPTCHA, pricing/document rules, simulated AI/voice, complete desktop/mobile calculator journeys and artifact validation.
- All 140 JavaScript syntax/import checks; final dependency audit: zero known vulnerabilities. The security patch left browser assets byte-identical.
- Actual Supabase ownership, concurrent-update, expiry and deletion checks; production-build profile/company-fact journeys and all eight desktop/mobile saving-choice cases. Synthetic records were removed, including four submissions and four estimates from the saving-choice cases.
- Offline browser journeys through the patched Vite preview and 138 established normal API comparisons against the production commit. The new HTTP 400 response for non-object JSON is an intentional correction.
- Refreshed port 5173 preview: entry, 12 areas, expected server calculation with recording off, logout and private-state clearing.

Production was not redeployed or reconfigured. AI/voice providers were simulated; physical devices/microphones and a fresh live human-CAPTCHA journey were not tested. Details: [overall findings](history/CODE-PERFORMANCE-REVIEW-2026-11-11.md#fresh-overall-regression-and-fixes).

## Refactored local build compared with production — 11 November 2026 (not deployed)

Production remains Ready at commit `4d841dd3fdcc7e4d5e9b522e9c7f103295e56093`. The local refactor has not been published.

- Nine deployed rule/validation files match local. All 138 original/refactored API comparisons matched, including 12-area workflow/agent estimates, ROI, changing/clearing answers, validation and simulated AI/voice contracts.
- The same complete desktop/mobile calculator journeys passed against the downloaded deployed bundle and the refactored build with synthetic local API responses.
- Actual Supabase profile/company-fact journeys and all eight desktop/mobile saving-choice cases passed on the local production build. Four synthetic submissions, four estimates and the tests' owned profiles were removed; existing records were preserved.
- Actual live entry checks passed at 1440px, 390px and 320px: required fields, unchecked saving defaults, visible v2, unchecked-CAPTCHA blocking, preserved input and no overflow/runtime errors. No live form submissions were made by this check.

No unintended functional differences were found. AI/voice responses were simulated, with no paid requests or physical microphone test. Normal localhost CAPTCHA configuration still differs intentionally from production. These results do not claim a new complete live entry through Google's image challenge. Details: [code/performance review](history/CODE-PERFORMANCE-REVIEW-2026-11-11.md).

## Visible v2 checkbox - 10 November 2026 (deployed)

Published the [visible v2 checkbox](https://github.com/AOCGithub/aoc-estimate-calculator-app/commit/7d683f9984fca4fbce67de6d0ec5053d09afb71e) to [the AOC estimator](https://estimate.alwaysopencommerce.com/). Deployment `dpl_5jQ6ixhfqiStFQ8QT1x36uKL3CZL` reached **Ready**. Vercel Production selects `RECAPTCHA_VERSION=v2` with matching keys; the private secret remains server-only. Pricing and database schema were unchanged.

- Passed shared v2/v3 Node/Worker verification, manual-review compatibility and desktop/mobile saving/calculation cases with synthetic providers. Unchecked, expired and rejected checks, provider/script/profile failures, fresh retries, logout and narrow-screen resizing are covered.
- Full `npm test` passed, including existing pricing/document rules, access/profiles, AI/voice contracts, desktop/mobile calculator journeys and packaged artifact validation. No paid AI requests or production database changes were made.
- Google's real v2 widget rendered and solved using its published test site key at 1440px, 390px and 320px under the production CSP. No overflow, CSP errors or browser runtime errors occurred. No form submissions or production records were created in this rendering check; test keys do not prove production bot protection.
- Live Google checkbox rendering, unchecked-submit rejection, preservation of form values/saving choices and no horizontal overflow passed at 1440px, 390px and 320px. The server rejected missing-token entry with saving both off and on, plus anonymous profile writes. These checks created no production records.
- Live assets, published pricing/prefill rules, favicon, server-key exposure checks, protected APIs and canonical/protected Vercel URLs passed. No paid AI requests were made.

Google presented the automated browser with an image challenge, so real-key successful entry/replay/calculation are not marked passed by that run. The user completed the live checkbox in a normal browser and confirmed the calculator opened successfully. This confirms real-key entry; replay and complete calculator regressions remain covered by the separate local tests. Google may accept a checkbox without an image puzzle. Maintenance: [entry bot protection](features/RECAPTCHA.md).

## reCAPTCHA entry protection - 10 November 2026

Published [reCAPTCHA v3 and canonical entry handling](https://github.com/AOCGithub/aoc-estimate-calculator-app/commit/1e4cf98ee4c84308e4efa77c923da85c724c0ba8) to [the AOC estimator](https://estimate.alwaysopencommerce.com/). Application deployment `dpl_6iY8b69zerqrvxvNrTxGS6yNeJvh` reached **Ready**. Subsequent documentation commits have the same application source.

Passed:

- Full local `npm test`, including Node/Worker CAPTCHA verification and all eight desktop/mobile saving-choice cases with synthetic providers. Missing/expired/reused tokens, wrong actions/hostnames, low scores, incomplete configuration, quota/provider failures, protected profile writes, retries and unchanged calculations passed. The real-Supabase local profile/calculator journeys also passed and removed their synthetic records.
- Real Google-backed entry on the AOC domain, missing-token rejection, reused-token rejection, anonymous profile-write rejection, session-protected calculation, logout, visible Google disclosure, hidden floating badge and no overflow/runtime errors. No AOC data was saved in that acceptance session.
- All four live saving choices at 1440px and 390px: actual Supabase records, linked estimates, correct calculations, logout and forgetting profiles. Four synthetic submissions and four snapshots were removed; the test's profiles were also deleted.
- Complete live desktop/mobile calculator journeys, including save-failure recovery, changed/cleared answers, linked snapshots, opt-out, refresh and logout. Two synthetic submissions and eight snapshots were removed. An earlier test-only assertion had rejected Google's observed `_grecaptcha` storage key; that run removed its one submission and four snapshots. Updated privacy checks permit only that Google key and still reject AOC personal details in browser storage.
- The older public Vercel entry address redirects to the AOC hostname registered with Google. The two internal stable aliases retain Vercel sign-in protection. App redirect rules apply only to entry URLs and preserve API and asset paths.

The first real script check exposed asynchronous Google SDK initialization that the original fixture did not reproduce. The prior live release was restored while the loader was corrected. Added delayed-bootstrap, timeout and late-result coverage passed, followed by successful real Google verification. No CAPTCHA bypass or weakened score threshold was used.

Production keys remain in Vercel. The default score threshold is 0.5; the server checks action, hostname and two-minute freshness before creating sessions or saving requests. Optional profiles save after that verified session, closing the anonymous profile-write path. Google uses its own necessary browser storage, separately from AOC's unchecked saving choices. Pricing formulas/data, database schema and existing business-approval settings were preserved. This release made no paid OpenAI requests and did not enable a paid CAPTCHA plan.

Maintenance and rollback: [entry bot protection](features/RECAPTCHA.md). Physical-device coverage and future bot-detection scores remain separate from these browser checks.

## Project organization and AI-prefill validation - 10 November 2026

Published the [file reorganization](https://github.com/AOCGithub/aoc-estimate-calculator-app/commit/cb115792018ee6f4625b7748f0528bfc3105bc48) and [management-evidence correction](https://github.com/AOCGithub/aoc-estimate-calculator-app/commit/e781f6857bf2ade0af63e823d46199d4797bad91) to [the AOC estimator](https://estimate.alwaysopencommerce.com/). Vercel deployment `dpl_6kDxinibM8n9qns3oxeeHBShhPfu` reached **Ready** with the AOC domain alias. Subsequent documentation commits contain the same application source.

Passed on the deployed domain:

- All four independent profile/estimate-saving choices at 1440px and 390px: eight cases checked actual database contents, calculation parity, logout and profile deletion.
- Profile consent, review/reuse, preserved current and cleared answers, separate same-email browsers, concurrent-update protection and selected/full deletion.
- Complete desktop/mobile form-to-calculation journeys with linked snapshots, edited/cleared answers, opt-out, save-failure recovery, refresh and logout.
- One live advertising prefill retest retained supported facts and left unknown people count, time savings and management blank. The initial check had exposed staff publishing being misclassified as future system management. The validator/prompt correction, direct Node/Worker regressions and an exact-description local real-provider retest passed before the successful deployed retest.
- One short synthetic voice session recognized **Testing** on its first occurrence and displayed words before Stop. One text-correction request verified spelling, commas, protected facts and Undo. Saving stayed off for this session.
- Live runtime/validation files and favicon matched source; browser JavaScript/CSS hashes stayed `index-jpKAXHrx.js` and `index-DFog-4VO.css`. Checked public assets contained none of the configured private server credentials. Session protection, blocked email lookup, profile availability and protected cleanup passed.

The saving-choice check removed its four synthetic submissions and four snapshots. The successful full journey removed two submissions and eight snapshots; the initial failed check also removed its one submission. Synthetic profiles were deleted and existing client records were preserved. No pricing formulas, coefficients, database schema or server settings changed.

Before publication, the full local suite passed, including 10,000 payment-rounding cases and 144 independent quote/ROI combinations. An additional 24 complete journeys covered all 12 business areas on desktop/mobile; 26 distinct required fields were cleared and corrected. The full suite passed again after the AI correction. These are browser-viewport and synthetic-audio checks; physical phones/microphones and every possible AI response remain outside this coverage.

Maintenance: [project structure](../README.md), [pricing/forms](PRICING-AND-FORM-MAINTENANCE.md), [entry/saved data](GATE-AND-SAVED-DATA-MAINTENANCE.md). Repeatable deployed checks: `npm run test:gate-saving:live`, `npm run test:intake-access:db -- --live`, and the profile browser tests with `AOC_PROFILE_TEST_URL` set to the AOC domain.

## Redesigned calculator release - 6 November 2026

Published application commit [353e2eb](https://github.com/AOCGithub/aoc-estimate-calculator-app/commit/353e2ebd097a700e0d72ea000f80a76c3b12d42a) to [the AOC estimator](https://estimate.alwaysopencommerce.com/). Vercel reported **Ready** for `dpl_EzuhvekFSp2wCj3rMcG4WKV9wctn` and confirmed that the AOC domain points to this commit. The release includes the redesigned entry and workspace, compact expandable results, original AOC favicon as the header logo, AI-prefill validation fixes, tests and maintenance guide. Subsequent documentation commits contain the same application source.

Passed on the deployed AOC domain:

- Entry validation, unchecked saving choices, logo/font loading, scrolling and visible branding at 1440x900, 1366x640, 390x844 and 320x568.
- All four profile/estimate-saving combinations on desktop/mobile: eight cases with actual Supabase rows, correct linked calculation results, logout and profile deletion that preserves separately saved estimates.
- Profile review/reuse, preservation of current and cleared answers, browser/client separation, concurrent-update protection, selective removal and full deletion.
- Full form-to-Calculate journeys at 1440px and 390px, including saved snapshots, changed/cleared answers, save-failure recovery, refresh and logout. Two additional no-save journeys passed calculation/recalculation, JSON-download parity, reset cancellation, responsive layout, font loading and CSP checks.
- One real paid-advertising AI-prefill request retained the explicit fixed-price project and quoted audit, left ten unknown fields blank, kept the $3000 ad budget in its advertising field, and did not treat it as a provider fee or infer management help.
- Live pricing, question-bank, AI-validation and favicon files matched source. Checked browser assets contained none of the configured private server credentials. Access settings, session protection, blocked email lookup and protected profile cleanup passed.

The database checks removed only their six synthetic submissions, twelve estimate snapshots and synthetic profiles. Existing client records were preserved. Post-deployment checks used one short AI-prefill request; no live audio/correction requests were made in this release check. The real voice/correction pre-push results below cover those unchanged integrations.

Live assets: `index-jpKAXHrx.js` and `index-DFog-4VO.css`. The complete local regression suite passed before publication, including the pricing/ROI and rounding checks below. Pricing formulas, coefficients, database schema and server settings were unchanged. Verification/AOC approval and the WordPress link remain on hold. These browser checks do not replace physical-phone testing or guarantee every possible AI response.

## Local pre-push verification - 6 November 2026

The redesigned form, calculator, compact result layout and AOC favicon logo were checked locally before publication. These are the pre-push results; the subsequent deployment and live checks are recorded above.

Passed:

- Fresh full `npm test`: production build/Worker package, form validation, conditional questions, manual edits, seven-section desktop/mobile journeys, changed/cleared answers, stale-result indication, downloads, reset confirmation, access, profiles, AI/voice contracts and error recovery. Pricing checks cover 144 independent quote/ROI cases and 10,000 payment-rounding cases against the checked-in 28-29 October rules.
- `npm run test:profiles:cloud-ui`: the current production build served locally through the real Node handlers with Supabase. Profile review/reuse, manual and cleared-answer protection, concurrent changes, selective removal, full deletion and all four saving-checkbox combinations passed at 1440px and 390px (eight combination cases). Four synthetic submissions and four estimate snapshots were removed; synthetic profiles were also removed.
- `npm run test:profiles:database`: real profile ownership, concurrent-update rejection, selective removal, deletion and expiry passed. The global cleanup function was checked inside a rolled-back transaction. Only this test's synthetic profiles were removed.
- The full local form-to-Calculate Supabase journey passed at 1440px and 390px, including stored answers/results/versions, edited/cleared snapshots, opt-out, save-error recovery, refresh and logout. Its two synthetic submissions and eight snapshots were removed. An initial navigation timeout occurred while waiting for network-idle; the form was visible. The test now waits for the document and visible form. A separate readiness probe showed the form ready in 733ms and also reaching network-idle; that single local observation is not a production performance benchmark.
- Real AI-prefill retests: paid advertising and an invoice agent passed with exact source quotes, explicit project selection, draft versus approved actions and 15 unknown-field checks. The first paid-advertising check exposed an omitted explicit project choice, ad spend mapped to provider fees and a detailed **Help decide** answer inferred from unknown responsibility. The validation fixes and regression tests passed; actual provider fees and explicit management-help requests remain supported.
- One real short voice session using synthetic **Testing** audio: live text appeared before Stop, the final text retained existing typing, and the opening word was correct. One real spelling/list-punctuation correction preserved `$2500 monthly` and draft-only instructions; Undo restored the exact original. No physical microphone or customer recording was used.
- The local preview was refreshed to match production's available profile/estimate-saving settings. Browser-asset checks found no configured private server credentials. Built AI-validation, pricing, question-bank and favicon assets matched source. No pricing formulas, coefficients, database schema or live settings were changed.

Provider use for this pre-push run: three organizer requests (the initial failing acceptance check and two passing retests), one short realtime session, and one text-correction request. Other checks used mocks or no paid AI. Existing client records were preserved.

These checks cover the current submit-and-enter setup; verification/AOC approval and the WordPress link remain on hold. Physical iPhone/Android coverage and every possible AI response are outside this run. Unspecified fees remain pending rather than invented. Repeat a live smoke test after the new deployment is published.

## Gate and saved-data recheck - 6 November 2026

Rechecked the existing [live AOC estimator](https://estimate.alwaysopencommerce.com/) using synthetic records. No application behavior, pricing rules, database schema or WordPress content was changed. No paid AI requests were made.

Passed on desktop (1440px) and mobile (390px) Chromium viewports:

- All four combinations of **Remember my business details** and **Save my details and estimates with AOC**. Both choices began unchecked, remained independent and reset after logout. Direct Supabase checks confirmed that profiles, submissions and estimate snapshots were created only for the selected choices.
- Each of the five blank required entry fields blocked submission; correcting the field restored validity. Calculation was blocked before entry and after logout. Valid entry opened all twelve business areas with a fresh set of answers.
- Server-calculated answers/results matched the fixture in each saving combination. Profile-only sessions did not record estimates. Deleting a remembered profile preserved separately saved estimates.
- Explicit review/reuse, same-email isolation between browsers, preserved manual/cleared answers, company-fact provenance, stale-update rejection, selective removal and full profile deletion.
- Form save-failure/retry and calculation save-failure messages, with entered details/results retained. The longer live form journey also passed the Calculate button, changed/cleared answer snapshots, refresh, session clearing and no horizontal overflow.

Repeatable checks run:

- `npm run build:worker`, `npm run test:access` and `npm run test:profiles` passed locally. These include signed-session protection, tampered requests, consent enforcement and storage failures.
- Live `npm run test:profiles:ui`, using `AOC_PROFILE_TEST_URL=https://estimate.alwaysopencommerce.com` and `AOC_PROFILE_STORAGE_KIND=supabase`, passed.
- `npm run test:intake-access:db -- --live --skip-ai` passed; it removed its two synthetic submissions and eight estimate snapshots.
- New `npm run test:gate-saving:live` passed all eight viewport/choice cases; it removed its four synthetic submissions and four estimate snapshots. All synthetic profiles from these checks were also removed. Existing client records were preserved.

Maintenance and client-record lookup: [entry and saved-data guide](GATE-AND-SAVED-DATA-MAINTENANCE.md). The repeatable four-choice check is [test-gate-saving-choices.mjs](../tests/database/test-gate-saving-choices.mjs).

The WordPress link/button and website-to-calculator journey are deferred at the user's request. Verification and AOC approval remain paused; the tested behavior is valid submission followed by calculator access. These results do not certify that paused workflow or physical phones. This earlier gate/saving check made no application changes; its tests and maintenance notes are included in the release above.

## Calculator, profiles and scrolling release - 4 November 2026

Published application commit [7e68911](https://github.com/AOCGithub/aoc-estimate-calculator-app/commit/7e68911640639fc967f563ecc4b62cfcbecb12a6), followed by the tested AI-prefill safeguard [c13b734](https://github.com/AOCGithub/aoc-estimate-calculator-app/commit/c13b734ab78af284c99edb6ce99d944eb985be57). [The live AOC estimator](https://estimate.alwaysopencommerce.com/) was verified Ready on Vercel deployment dpl_G5TBaT1WStWhHMjy1GDS51Zv86uY. Subsequent documentation commits contain the same application source.

Active rules: 2026-10-29-fixed-project-v1. Source metadata was rechecked before release: framework, agreement and workbook remain modified on 29 October. Fixed-price launch builds are active; monthly builds are deferred, reusable training is included, live training is separately quoted and unspecified support fees stay unknown.

Passed on the deployed AOC domain:

- Desktop/mobile profiles: independent unchecked consent, opt-out, reviewed details/facts, provenance, protected manual/cleared answers, same-email isolation, stale updates, selective removal, deletion and fresh calculation. Only synthetic profiles were used and removed.
- Real Supabase intake/estimate journeys at 1440px and 390px: required fields, save failure/retry, linked snapshots, edited/cleared answers, Calculate button, version, no-save mode, reload and logout. Removed only the tests' two intake rows and eight estimate snapshots.
- Seventeen calculation cases: fixed quotes/audit/credit, included and purchased training, provider-savings eligibility, unknown replacement costs, exact-cent 50/50 payments, changed/cleared hours, negative ROI, missing scope, unspecified management fees, deferred-program rejection and excluded-payroll rejection. Saving was off.
- Entry validation/scrolling at 1440x900, 1366x640, 390x700 and 320x568: each blank required field blocked submission, corrected fields became valid, both saving choices stayed unchecked, pinned branding and end-of-form reachability passed without horizontal overflow.
- AI prefill: paid advertising and invoice-agent scenarios passed with exact evidence, explicit project choice, draft versus approved execution, management intent and unknown prices. An initial intermittent project-choice omission prompted the narrow exact-quote safeguard. The repeat and both final live cases passed; negative/uncertain/conflicting choices have regression coverage. This does not guarantee every possible AI response.
- Voice: one short synthetic Testing sample produced live/final text, retained existing typing and recognized the opening word. One spelling/list-punctuation correction and Undo check passed. No physical microphone or customer recording was used.
- Live pricing, bank and AI-contract files matched source. Security headers, protected cleanup (401 without authorization), denied profile email lookup and unauthorized-calculation protection passed.

Before publication, npm test passed, including 10,000 exact-cent balances and 144 independent quote/ROI cases. Production-build/Supabase profile journeys and RLS/anonymous-denial checks passed. Configured private server credentials were absent from the checked release/browser files. Production assets: index-tQ-RsQGn.js and index-pUz7e7tp.css.

The daily profile cleanup job is registered at 03:00 UTC. Its SQL function and authorization were tested; its first scheduled execution has not yet been observed. Disclosed profile expiry defaults to 30 days and is configurable. Verification/AOC approval remains paused. Physical-phone/microphone coverage remains separate from browser viewport and synthetic-audio testing.

Release provider checks used four short prefill requests (including the initial omission/retry), one short realtime session and one text-correction check. Other checks used no paid AI. Maintenance: [pricing/forms](PRICING-AND-FORM-MAINTENANCE.md), [profiles](features/OPTIONAL-CLIENT-PROFILES.md), [voice](features/LIVE-VOICE-INPUT.md).

## Entry design release — 3 November 2026

Published application commit `55d77ee6b896b5e6b4bcebd96c718e9bf74ff3e9` to [the live AOC estimator](https://estimate.alwaysopencommerce.com/). Vercel reported Ready for deployment `dpl_5XV2LMF8XBYJBbk6B5oF4fVzBZ1j`. The Aurora entry page is live, **How it works** is removed, and the calculator retains its original navigation, forms and estimate sidebar. Pricing and API behavior were unchanged. The production security policy permits the entry page's self-hosted font.

Passed live Chromium checks at 1440px, 390px and 320px: required entry fields, unchecked optional saving, font loading, Aurora rendering, calculator entry, all twelve business areas, responsive navigation, no horizontal overflow and logout. Full desktop and mobile journeys also passed server calculation, edited-answer recalculation, downloaded-summary parity and reset cancellation. The deployed assets matched the local build using the production access-form flag, and no browser errors or security-policy violations were detected.

Synthetic details only; saving stayed off. Calculation responses confirmed persistence was skipped. No database records were saved and no paid AI calls were made. The existing local pricing, access/saving, voice/correction and complete browser regression checks passed before publication. Browser viewports were used rather than physical phones.

## Voice reliability and correction release — 3 November 2026

Published application commit `cf69d4ec4fd10cb5b30f50f57f45f1ea939e0de2` to [the live AOC estimator](https://estimate.alwaysopencommerce.com/). Vercel reported Ready for deployment `dpl_NSNRJSHwMfTG3AmHBQSL7JZaUCBr` and confirmed the release commit on `main`.

Passed live synthetic-audio checks at 1440px and 390px: **Testing** was recognized on its first occurrence, words appeared before Stop, the final transcript arrived afterward, existing typed details remained intact, captured text was editable, no horizontal overflow appeared, and logout worked. One additional desktop text request verified spelling and list-comma correction, preservation of `$2500 monthly` and draft-only/approval instructions, and Undo. Data saving stayed off; no form or estimate records were saved.

The full local regression suite passed before publication, including silent audio, delayed/out-of-order finals, send failures, final timeouts, unavailable microphones, device removal, background-tab cleanup and recording/text limits. A separate six-second real-provider silence check passed locally without adding words. This release keeps unclear wording reviewable rather than promising recovery of inaudible speech. Physical iPhone/Android microphone, accent and noise checks remain separate from synthetic browser tests. See [voice maintenance instructions](features/LIVE-VOICE-INPUT.md).

## Voice input release — 30 October 2026

Published application commit `d53a50e25252e0f297395d99e9e04b5250a0dd40`. Vercel reported Ready for the production deployment, with `AOC_VOICE_ENABLED=true` and `AOC_DESCRIPTION_CORRECTION_ENABLED=true`. Both features use the existing server-side OpenAI key; the page permits microphone access from its own origin.

Passed on the live AOC domain using synthetic audio at 1440px and 390px: microphone preparation, words appearing before Stop, final transcription, editable captured text, preservation of existing typed text, no horizontal overflow, and logout. “Testing” was correct on its first occurrence in both live and final transcripts, including the single-word mobile-viewport sample. One additional live desktop spelling check corrected typed misspellings, preserved the amount and draft-only/approval restrictions, and supported Undo. Database saving stayed off for both test sessions. These checks used two short audio sessions and one text-correction request; no physical microphone, customer audio or saved form/estimate records were used.

The full local regression suite passed before publication. Physical phone browsers, microphones and accent/noise coverage remain separate from these synthetic Chromium checks. See [voice maintenance instructions](features/LIVE-VOICE-INPUT.md).

## Optional saving release — 30 October 2026

Published application commit `a40900289440b18b5270a4af556afe4a11b17637` to the live AOC domain. The saving checkbox starts unchecked. Without explicit selection, entry and calculation work without writing business details or estimate records to AOC's database. Selecting it retains the linked saving flow. Ending a session clears answers held on the page; existing database records are preserved.

Passed real deployed browser/Supabase checks at 1440px and 390px: both saving choices, no-save submission absent from the form table, skipped estimate persistence with unchanged calculation results, saved snapshots and edited/cleared answers, required fields, save-error recovery, refresh/logout and clearing the previous visitor's on-page estimate. The full isolated release regression suite passed before publication. Only the tests' own two saved submissions and eight estimate snapshots were removed. No paid AI requests or database schema changes were made for these checks.

Repeat the data-only live check with `npm run test:intake-access:db -- --live --skip-ai`.

## Submit-and-enter release — 30 October 2026

Published application commit `f7b6816af291dfd813b991a19fedebb0cfffb448` to [the live AOC estimator](https://estimate.alwaysopencommerce.com/). Vercel reported Ready for deployment `dpl_62mVRSWuaj3honSGU9jDhMr4vfu1`. The shared handlers/templates, linked form/calculation storage, removed preview badge and focus-clipping fix are included. Pricing rules were not changed.

Passed on the live domain at 1440px and 390px:

- All five entry fields save to Supabase, then the calculator opens without email approval, verification codes or invitations. Required-field validation remains active.
- Signed sessions use HTTP-only, Secure cookies; reload and logout work. Requests without a session are blocked from calculation.
- Server calculation matches the fixture and stores answers, result and pricing version under the correct form submission ID. Editing or clearing answers creates a new snapshot without overwriting earlier results.
- The complete form-to-Calculate browser journey saves successfully, with no horizontal overflow. Simulated save failures retain entered data/results and show an honest warning.
- One live paid-advertising AI-prefill request returned structured facts with source evidence and left unknown people, management and time-saving details blank. No second paid request was made.

The full local regression suite and database RLS/grant checks passed before release. The smoke test removed only its own two synthetic form submissions and eight estimate snapshots; existing records were preserved. Browser checks used Chromium desktop/mobile viewports, not physical devices. Broader live AI acceptance remains separate from this one-request smoke check.

Repeat this release check explicitly with `npm run test:intake-access:db -- --live` (one paid AI request). Without `--live`, the command targets localhost and makes no paid AI calls.

## Verified deployment and updates

- Confirmed `https://estimate.alwaysopencommerce.com/` loads successfully over HTTPS on 28 October 2026.
- Confirmed the production organizer returns validated structured prefill with configuration version `2026-10-21-commercial-v1`.
- Confirmed the production calculation endpoint returns server results using the same commercial version.
- The earlier domain-invalid and local-organizer-only status is historical and no longer describes the current deployment.

## Commercial server verification - 28 October 2026

Synthetic server checks confirmed:

- A fixed-price project uses the separately quoted audit amount rather than a percentage of the build.
- One eligible paid-audit credit is applied once under the 30-calendar-day acceptance and first-payment rule.
- The remaining fixed-project balance is split into two equal project payments.
- A selected Level 2 monthly build program returns the reviewed `$7,000` monthly fee, with no separate upfront build charge or fixed-project payment schedule.
- The monthly result keeps the agreed combined hours and agency blend pending when they have not been supplied by AOC.
- The server returned `2026-10-21-commercial-v1` for both routes.

All amounts entered for these checks were synthetic fixtures. They are test evidence, not approved customer quotes or package-hour entitlements.

## Earlier production UI verification - 21–22 October 2026

- Added and deployed an accessible processing state for **Organize my description**, including clear status messages, duplicate-action protection, and reduced-motion support.
- Added a short, reduced-motion-safe transition when moving between the seven form sections.
- Completed a production mobile journey and desktop rendering check with no page-level overflow under the then-current deployment.
- Verified required indicators, numeric validation, partial results for missing material scope, and server-verified results after completion.
- Completed representative Finance and billing, Customer service and returns, and Paid advertising journeys.

These earlier browser checks do not replace a final browser pass after the current commercial deployment.

## Historical follow-up list from the 30 October smoke test

- Fixed-project journeys and deferred-monthly rejection were completed in the 4 November checks above.
- Save final deployed desktop and mobile evidence for the current commercial version.
- Complete broader live AI-prefill scenarios and resolve any findings before final handoff.
- Complete physical-device sign-off on iPhone Safari and Android Chrome if required for formal acceptance.
