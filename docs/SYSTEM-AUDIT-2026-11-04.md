# System and document-alignment audit

Date: 4 November 2026 (Asia/Manila)
Initial audit result: **Functional checks passed; document/pricing alignment failed.**

Follow-up result: **All six identified document-alignment defects are corrected locally and the regression checks passed.** Current local rules: `2026-10-29-fixed-project-v1`. Optional profiles also have a tested production implementation with Supabase schema and Vercel settings prepared. Production still serves the earlier version; the application changes have not been deployed. This is evidence for the tested scope, not a guarantee of every AI response, device or input combination.

Local state: application commit `29070dc` plus the uncommitted optional-profile implementation. Production serves bundle `index-BEYg14WH.js`. The live and local pricing assets matched during this audit. Profile changes remain local.

The initial audit made no application changes. The authorized follow-up applied the documented corrections below. No source documents, production deployment or database schema were changed.

## Sources and precedence

- [Implementation task](https://docs.google.com/document/d/1ZR-7dAayjtmejgo6GQrtJeI3FSj3kGjNeq_7zIuEPMA/edit): modified 21 October; still describes the older monthly-build offer.
- [Current framework](https://docs.google.com/document/d/1okDUVm5wE4MrPiFANlvQIrCJ1sC8omfXCssy37WqCdw/edit): modified 29 October; explicitly says the 28 October fixed-price launch decision supersedes the earlier monthly-build direction.
- [Current agreement/SOW/SLA](https://docs.google.com/document/d/15BxB-yzw8U1oP_1B2cpJu2EUgh3P8rnqKT5_ZqdT3dA/edit): modified 29 October; confirms fixed-price launch builds, separate optional management and direct client payment for Make.
- [Current workbook](https://docs.google.com/spreadsheets/d/1vUDbKYWQPTaVIvJEYGzY5pVDCt0n369Ywel0tPk9M7s/edit): modified 29 October. Metadata for all 68 tabs was read; bounded reads covered 30 relevant rule, question, calibration and test tabs. Native formulas were inspected without changing workbook inputs.

The newer framework and agreement resolve the apparent launch-offer conflict with the older implementation task. These are documented directions, not proposed new prices. The app's commercial configuration still identifies itself as `2026-10-21-commercial-v1`.

User-authorized exceptions remain separate: verification/AOC approval is paused, and profiles are being tested locally. This audit does not authorize enabling approvals or publishing local profiles.

## Original confirmed findings (now corrected locally)

| Finding | Evidence and effect | Required correction |
| --- | --- | --- |
| **1. Deferred monthly builds remain active** | Workbook `START HERE` rows 21, 27 and 34, `Future Monthly Builds` rows 1–4, plus the newer framework/agreement, make monthly builds a deferred future option. The live app still accepts and presents the monthly build route and its earlier program fees. | Present fixed-price builds as the current route; keep optional monthly management separate. Preserve deferred monthly logic as history rather than an active offer. Update stale task/maintenance notes to identify the newer baseline. |
| **2. Included training is still charged in the draft build** | `Workflow Automation!B24`, `B20`, `B25` are all zero for included training materials. App `core.handover` remains 250 / 500 / 1000, and `public/engine.js` adds a Training & handover line. In the same unquoted example, the app produces 11,250 / 11,500 / 12,000 rather than 11,000 after including training. This reproduced on production. | Refresh the reviewed snapshot/generated active rules and remove the separate reusable-material surcharge. Keep separately accepted live training and explicit AOC project quotes distinct; do not automatically reduce an entered accepted quote. |
| **3. Provider savings are counted outside the workbook's eligible areas** | `Web Calculator Test!B63` returns zero outside areas 6–10. `public/commercial.js` reintroduces provider replacement in every area. A Finance example with a 900 provider fee produces net benefit 2,500 and payback 4.6 months; the workbook rule gives net 1,600 and payback 7.1875 months. Reproduced through the live server API. | Align input visibility and server calculation with documented replacement eligibility. Retain only evidenced, eligible replaced costs. |
| **4. Partial replacement can produce full ROI despite an unknown total** | `Web Calculator Test!B63:B64` require both the current fee and partial amount, with partial not exceeding the fee. The app accepts an unknown current total plus a 100 partial saving and reports net 1,700. The Sheet leaves that saving/net unknown. Software case reproduced on production; both provider/software cases reproduced locally. | Require the documented current-total/portion validation and leave incomplete savings and downstream net/payback unknown. |
| **5. Half-cent payment rounding differs from the Sheet** | With project 11,250.05 and audit credit 1,250, the remaining balance is 10,000.05. Sheet `Audit & Project Quote!B22` rounds the first half to 5,000.03; the live app gives 5,000.02, then 5,000.03 for the second payment. Totals reconcile, but the first-payment rule differs. | Use exact integer-cent rounding for the first half, then reconcile the second half. An independent 10,000-case low-balance sweep found 271 such first-payment differences; a normal-sized project also reproduces it. |
| **6. Excluded/overview rows leak into the question bank** | All 12 category banks were compared by field ID. Eight compiled entries come from route-overview rows rather than the detailed-field rows. Their option text is status metadata. In particular, `People & HR` rows 5–6 explicitly exclude payroll, but `payroll` remains in the bank: it was searchable/addable in the local browser and accepted by the production calculation API. | Correct row-type/status filtering in the compiler; exclude prohibited scope from both UI and allowed AI/server field lists. Preserve legitimate detailed questions. |

Additional copy gap: the 29 October client-owned Make account/direct-billing requirement is not surfaced in the current calculator's client-requirements copy. Carry that requirement into the relevant results/next-step explanation without adding account creation, billing or credit-rebilling features.

The app/Sheet marketing build-calibration numbers matched in the inspected `Web Calibration` rows. The core workflow values also matched except the three training/handover amounts. The remaining core/agent/calibration figures are still labelled provisional by the sources; matching them does not make them final approved prices.

## Checks that passed

- Fresh `npm test`: build and Worker packaging; seven-section form, required/invalid answers, conditional fields, editing/removal, stale-result handling, downloads/reset, complete desktop/mobile Chromium journeys; access and saving; pricing fixtures; AI/voice contracts, errors and recovery; typography/Aurora/CSP; artifact validation.
- Fresh profile API and desktop/mobile browser tests: unchecked consent, opt-out, private browser ownership, no email lookup, selected company-fact saving/reuse, source tracking, identity checks, manual/fresh-AI/cleared-answer preservation, stale-update/deletion protection, explicit removal, expiry and fresh calculation. These remain local-only checks.
- Independent integer-cent oracle: **144 ordinary quoted-project scenarios passed** for totals, credit, 50/50 payments, initial spend, 80/20 time, monthly net, annual investment/benefit and payback. The separate rounding sweep and documented source mismatches above are failures, not covered by that passing count.
- Live Supabase browser journey at 1440px and 390px: optional/no-save modes, successful linked saving, failure recovery, edited/cleared snapshots, Calculate button, reload/logout. Removed only this test's **two synthetic submissions and eight estimate records**.
- Live database checks: row-level security, anonymous denial, insert-only application grants, estimate ownership foreign key, indexing and restricted deletion passed. No public profile table was added.
- Live AI prefill: one synthetic paid-advertising description returned grounded facts, left unknown people/management/costs blank, retained draft-only authority and selected fixed-project intent.
- Live voice: one short synthetic recording recognized **Testing** in live and final text, preserved existing typing, and supported the final transcript. One text-cleanup/Undo check also passed. These used one realtime session and two text-model feature tests in total, not customer audio.
- Live public-asset check: none of five configured server credentials appeared in the inspected application/runtime assets; no credential-bearing VITE variable was found. Anonymous calculation was blocked with HTTP 401; CSP and microphone policy were present.
- The documented pricing problems were also reproduced through the live calculation API in a no-save session. They are not limited to the new local profile version.

## Limits and inputs needed

No further access or person was needed to complete this audit. The documented corrections above can be specified from existing sources; no new pricing coefficients should be invented.

For complete final-price outputs, AOC still needs to supply the missing support/management prices and any final calibrated build/agent amounts it wants to replace the provisional figures. Until supplied, pending/unknown outputs are correct. Explicit per-project audit/build quotes can still be entered as references; the calculator does not approve those quotes or accept payment.

Physical iPhone/Android browser, microphone, accent and background-noise coverage needs representative real-device testing. This audit's browser viewports and synthetic audio do not certify every device, voice or AI response.

Two business-area narrative prompts are blank in the workbook (Orders/Fulfillment and Customer Service/Returns); the app uses a generic fallback. Some source banks are themselves marked incomplete. No claim is made that every possible question combination or every cell of every legacy tab was independently validated.

Passing tests establish tested behavior against the current implementation. They do not override the newer business instructions, validate provisional selling coefficients, guarantee actual ROI, or establish 100% recognition accuracy.

## Evidence and repeatability

Local ignored evidence files:

- `artifacts/system-audit-source-evidence-20261104.json`: source modification dates, core differences and 12-bank comparison.
- `artifacts/calculation-audit-20261104.json`: independent ordinary calculations, rounding cases and source-rule counterexamples.
- `artifacts/live-pricing-audit-20261104.json`: live server responses for the confirmed pricing issues.
- `artifacts/browser-audit-20261104.json`: excluded HR field reproduction and live AI facts.
- `artifacts/secret-boundary-audit-20261104.json`: public-asset/session-boundary checks without credential values.

Repeat standard checks with `npm test` and `npm run test:profiles`; with the local profile server running, use `npm run test:profiles:ui`. Live provider/database checks are separate explicit commands and may use credits or create/remove their own synthetic records.

## Correction and retest — 4 November 2026

The supplied documents are treated as approved. Their explicit 28 October fixed-price launch decision takes precedence over the older monthly-build planning instructions. No new selling coefficients, discounts, support fees or product features were introduced by this correction.

- Fixed-price builds are the active launch route. Deferred monthly plans and their allowances are unavailable in the form, AI field schema and calculation API; earlier planning data and arithmetic remain historical references. Existing agreement reconciliation is preserved.
- Included reusable training has zero separate surcharge, matching `Workflow Automation!B20,B24:B25`. Separately purchased live training remains quoted. Entered accepted project quote totals are preserved.
- Provider savings apply only to areas 6–10. Partial provider/app replacement requires the current total and removed portion; missing material figures leave net ROI/payback unknown. Savings exceeding the current total are rejected.
- Project payments use integer cents for the first 50% and reconcile the second payment. The $10,000.05 balance now splits $5,000.03 / $5,000.02.
- The compiler reads detailed question rows and excludes overview/status metadata and excluded payroll. All **982** detailed questions across all **12** business areas match the current workbook in ID, route, wording, options, display rule and purpose. Evidence: `artifacts/full-question-parity-20261104.json`.
- The results explain client-owned Make accounts, direct vendor billing and no AOC credit rebilling. The short maintenance guide now identifies the 28–29 October baseline and current compilation/release procedure.

Retest results:

- `npm test` — passed: production build/Worker, entry/saving contracts, forms, validation, desktop/mobile journeys, API guards, historical arithmetic, active commercial rules, voice/correction regression checks and artifact validation.
- `node tests/test-document-rules.cjs` — passed, including **10,000** exact-cent payment balances and **144** independent quote/credit/ROI combinations, 12-area provider eligibility, incomplete savings and excluded-field boundaries.
- `npm run test:profiles` and `npm run test:profiles:ui` — passed, including 1440px/390px company-fact reuse, consent, edit preservation, fresh server calculations, stale results and removal. Browser checks used a fresh isolated local server on port 5176.
- Two short synthetic real-provider AI tests against current local API code — passed. Deferred monthly choices stayed absent, explicit draft-only authority was preserved, supported fixed quotes were extracted and unknowns stayed blank. No records were saved. Evidence: `artifacts/commercial-ai-results.json`.
- `git diff --check` — passed.

The source metadata was checked again and still shows the framework, agreement and workbook modified on 29 October. Unspecified support prices and source-labelled provisional coefficients retain their documented status. Physical-device/microphone coverage and a fresh deployed-version check remain separate from this local correction. No push or deployment was performed.

## Calculator output journeys — 4 November 2026

Six real local-browser journeys passed: the following three synthetic scenarios at both 1440px and 390px, using the real local calculation API with saving disabled. Expected totals were specified independently of the calculator response. Sample quote amounts below are test inputs, not new configured prices.

| Synthetic scenario | Provisional scope build | Entered project total | Audit / eligible credit | Two balance payments | Net monthly benefit | Displayed payback |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Finance workflow | $11,000 | $11,500 | $1,250 | $5,125 + $5,125 | $1,600 | 7.2 months |
| Customer-service agent | $11,000 | $12,000 | $1,000 | $5,500 + $5,500 | $3,300 | 3.6 months |
| Paid-advertising workflow | $9,650 | $10,800 | $900 | $4,950 + $4,950 | $3,850 | 2.8 months |

The browser tests checked the actual displayed amounts, not only internal result objects: draft builds before a quote, quoted totals, audit/credit, both payments, capacity, net benefit, first-year totals and payback. Changing hours recalculated correctly; clearing them removed unsupported ROI. Unspecified management fees stayed unknown. Marketing checks also covered a missing replacement total, negative net benefit/no payback, and removing/restoring optional live training.

One additional editability issue was reproduced and corrected: channel/format counts supplied by prefill affected marketing build pricing (`Web Calculator Test!B55`) but appeared as editable controls only in Content & Social. The existing controls now also appear in other marketing areas when an answer was supplied, and remain available after clearing so clients can correct it. They stay optional there; no new questions, selling coefficients or pricing rules were introduced. Editing those counts recalculates provisional scope while preserving an explicitly entered accepted quote.

Evidence: `artifacts/marketing-prefill-editability-before.json`, `artifacts/calculator-output-results-20261104.json`, and six `artifacts/calculator-output-<width>-<area>.png` screenshots. This test used no paid AI calls and no persistent data writes. Prefill was a synthetic fixture; calculation requests used the actual local server. Build/Worker packaging, domain tests (including 10,000 payment splits and 144 independent quote/ROI cases), API checks and artifact validation passed again. The maintained desktop/mobile browser suite also passed with the added regression for optional count visibility, editing, clearing and preservation after reorganization. Changes remain local, not deployed.

## Optional profiles: production preparation — 4 November 2026

The local-only profile protocol now has Supabase persistence and Vercel endpoints. The offline SQLite adapter reuses the same handler and is excluded from the deployed profile path. Server availability controls the UI, including compatibility when the feature is disabled. Profile consent and existing estimate-recording consent are independent and unchecked. Review, selected company-fact reuse, provenance, manual/cleared-answer protection and revision-checked updates/removals are preserved.

Created only public.client_profiles, its expiry index and a restricted cleanup function. RLS and anonymous-denial checks passed. Server-side profiles use a hashed browser capability; HTTPS cookies are host-only, Secure, HttpOnly and SameSite=Strict. Concurrent updates/deletion use database revision conditions. Profile removal preserves separately consented estimate records. The default disclosed 30-day retention is configurable; reads do not renew it, and a protected daily job removes expired rows.

Prepared the production server feature flags, disabled the local adapter there, and added CRON_SECRET as a sensitive Vercel value. Existing secrets were preserved. Metadata verified the settings exist; the final build was checked for exposed server credentials and leftover local-trial dependencies. No public profile-email lookup, account verification, email provider, pricing change or paid plan was added.

Validation passed:

- npm test: complete build/Worker, access/saving, profile protocol/security, pricing, AI/voice contracts/recovery and desktop/mobile journeys.
- npm run profiles:db:setup: new schema plus RLS, service-only CRUD, restricted cleanup and anonymous REST denial.
- npm run test:profiles:database: actual Supabase insert/read/update, same-email isolation, source records, racing updates, selective removal, deletion and expiry. Cleanup function executed inside a rolled-back transaction; only this test's synthetic profiles were permanently removed.
- npm run test:profiles:cloud-ui: production React build with real Node handlers and Supabase, desktop/mobile business details and company-fact journeys, independent consent, failure recovery and fresh calculator results. No paid AI calls or deployment.
- Production environment metadata and compiled-asset credential checks passed.

Supabase-backed local review: http://127.0.0.1:5180/. [Profile maintenance and release instructions](OPTIONAL-CLIENT-PROFILES.md). The current AOC website has not been redeployed; live endpoint/cookie/cleanup checks follow publication.
