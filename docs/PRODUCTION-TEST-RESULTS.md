# Production Test Results

Date: 21 October 2026
Last updated: 3 November 2026
Scope: Production verification required by the Phase 1 checklist

Pricing scope: the active calculator uses the reviewed 21 October commercial rules. The live workbook was rechecked through its 24 October modification; unapproved hours, support prices, coverage, and allowances remain pending.

## Entry design release — 3 November 2026

Published application commit `55d77ee6b896b5e6b4bcebd96c718e9bf74ff3e9` to [the live AOC estimator](https://estimate.alwaysopencommerce.com/). Vercel reported Ready for deployment `dpl_5XV2LMF8XBYJBbk6B5oF4fVzBZ1j`. The Aurora entry page is live, **How it works** is removed, and the calculator retains its original navigation, forms and estimate sidebar. Pricing and API behavior were unchanged. The production security policy permits the entry page's self-hosted font.

Passed live Chromium checks at 1440px, 390px and 320px: required entry fields, unchecked optional saving, font loading, Aurora rendering, calculator entry, all twelve business areas, responsive navigation, no horizontal overflow and logout. Full desktop and mobile journeys also passed server calculation, edited-answer recalculation, downloaded-summary parity and reset cancellation. The deployed assets matched the local build using the production access-form flag, and no browser errors or security-policy violations were detected.

Synthetic details only; saving stayed off. Calculation responses confirmed persistence was skipped. No database records were saved and no paid AI calls were made. The existing local pricing, access/saving, voice/correction and complete browser regression checks passed before publication. Browser viewports were used rather than physical phones.

## Voice reliability and correction release — 3 November 2026

Published application commit `cf69d4ec4fd10cb5b30f50f57f45f1ea939e0de2` to [the live AOC estimator](https://estimate.alwaysopencommerce.com/). Vercel reported Ready for deployment `dpl_NSNRJSHwMfTG3AmHBQSL7JZaUCBr` and confirmed the release commit on `main`.

Passed live synthetic-audio checks at 1440px and 390px: **Testing** was recognized on its first occurrence, words appeared before Stop, the final transcript arrived afterward, existing typed details remained intact, captured text was editable, no horizontal overflow appeared, and logout worked. One additional desktop text request verified spelling and list-comma correction, preservation of `$2500 monthly` and draft-only/approval instructions, and Undo. Data saving stayed off; no form or estimate records were saved.

The full local regression suite passed before publication, including silent audio, delayed/out-of-order finals, send failures, final timeouts, unavailable microphones, device removal, background-tab cleanup and recording/text limits. A separate six-second real-provider silence check passed locally without adding words. This release keeps unclear wording reviewable rather than promising recovery of inaudible speech. Physical iPhone/Android microphone, accent and noise checks remain separate from synthetic browser tests. See [voice maintenance instructions](LIVE-VOICE-INPUT.md).

## Voice input release — 30 October 2026

Published application commit `d53a50e25252e0f297395d99e9e04b5250a0dd40`. Vercel reported Ready for the production deployment, with `AOC_VOICE_ENABLED=true` and `AOC_DESCRIPTION_CORRECTION_ENABLED=true`. Both features use the existing server-side OpenAI key; the page permits microphone access from its own origin.

Passed on the live AOC domain using synthetic audio at 1440px and 390px: microphone preparation, words appearing before Stop, final transcription, editable captured text, preservation of existing typed text, no horizontal overflow, and logout. “Testing” was correct on its first occurrence in both live and final transcripts, including the single-word mobile-viewport sample. One additional live desktop spelling check corrected typed misspellings, preserved the amount and draft-only/approval restrictions, and supported Undo. Database saving stayed off for both test sessions. These checks used two short audio sessions and one text-correction request; no physical microphone, customer audio or saved form/estimate records were used.

The full local regression suite passed before publication. Physical phone browsers, microphones and accent/noise coverage remain separate from these synthetic Chromium checks. See [voice maintenance instructions](LIVE-VOICE-INPUT.md).

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

## Additional acceptance coverage outside the 30 October smoke test

- Run the full current fixed-project and monthly-program journeys in the deployed browser UI.
- Save final deployed desktop and mobile evidence for the current commercial version.
- Complete broader live AI-prefill scenarios and resolve any findings before final handoff.
- Complete physical-device sign-off on iPhone Safari and Android Chrome if required for formal acceptance.
