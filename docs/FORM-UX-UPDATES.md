# Form UX Updates

Last updated: 10 November 2026
Status: The folder reorganization and a management-evidence AI-prefill correction were deployed and verified on 10 November 2026. The existing design, calculation rules and optional Supabase profiles remain active. See the production test results for release evidence.

## Purpose

This note records the recent prospect-facing form improvements so future work can build on them without restoring unnecessary fields or changing pricing behavior by accident.

## Completed changes

### AI-prefill management evidence - 10 November 2026 (deployed)

- Live testing exposed an unsupported management answer inferred from staff reviewing and publishing drafts, although the future manager was explicitly unknown. Core management answers now require management evidence; explicit unknown ownership stays blank. Explicit management choices and requests for help deciding remain supported.
- Added failing-case regression tests for the shared validator, Node API and Worker. The full local suite, an exact-description real-provider retest, and the deployed desktop/mobile calculator journey passed after the fix. Pricing formulas, coefficients, question choices and database rules were unchanged.

### Project organization - 10 November 2026 (deployed)

- Grouped React components and hooks by access, calculator, description/voice and profiles. Shared components and styles have dedicated folders.
- Grouped server helpers by feature, scripts by purpose, and tests into unit, integration, browser, database, provider and historical folders. Updated imports, packaging paths and existing npm commands.
- Added a [documentation index](README.md) and updated the [project guide](../README.md). Current maintenance and production-result links keep their existing paths; feature references and historical reports are grouped separately.
- The full local regression suite and additional desktop/mobile profile journeys passed. Comparison of the relocated code confirmed path-only changes. Pricing formulas/data, shared profile rules, schema migrations and CSS are unchanged; public API routes and existing npm command names are preserved. Live saving, profiles, calculations, voice and correction checks also passed. The separate AI-validation correction is described above; existing client records and production settings were preserved.

### AI-prefill corrections - 6 November 2026 (deployed 6 November)

- A real-provider test exposed an omitted fixed-price choice and an advertising budget incorrectly mapped to current provider fees. An explicit client choice now survives an unsupported model uncertainty; negated, conflicting and genuinely undecided choices retain their existing safeguards. Advertising/media budget evidence is rejected for provider fees and eliminated-provider costs, while the advertising-budget answer remains available.
- Applied the existing unknown-responsibility protection to the detailed advertising responsibility question too. An unknown manager stays unanswered; **Help decide** requires an explicit request for help. Actual agency fees and explicitly requested management help remain supported.
- Added regression coverage and passed the two real AI-prefill retests, including draft-only versus approved execution, explicit project choice, grounded quotes and 15 unknown-field assertions. The full local regression suite passed after these changes. Pricing formulas, coefficients, question choices and database rules were not changed.
- Refreshed the existing localhost:5173 preview with the current server settings; both remembered profiles and estimate recording now match production availability. No Vercel settings were changed. Results are in [production test results, local pre-push section](PRODUCTION-TEST-RESULTS.md#local-pre-push-verification---6-november-2026).

### Entry and calculator redesign - 6 November 2026 (deployed 6 November)

- Redesigned the entry page with a shared AOC wordmark, self-hosted Inter typography, a muted green palette and a cleaner split layout. The desktop form scrolls independently; mobile keeps normal page scrolling and visible branding. Privacy information is expandable. The five required fields and independent unchecked saving choices are retained.
- Updated the shared entry/calculator header logo to use the existing AOC tab icon (`public/favicon.png`), keeping the company name alongside it.
- Replaced the desktop side navigation with a horizontal seven-section navigation above a wider form workspace. Smaller screens retain the accessible section selector and a link to the estimate, without sideways navigation scrolling.
- The result leads with build price, audit, new ongoing costs, monthly economic benefit and illustrative payback. Costs, assumptions, value, connected scope and readiness are expandable. All 25 original named metrics, conditional outputs, warnings, terms and summary-download data remain available. The download action stays outside the scrolling result details.
- Unknown inputs remain unknown; changed answers show a recalculation notice. Calculation/pricing modules, API handlers, database rules, saving consent and voice behavior were not changed. The historical stylesheet is retained for legacy pages; active React styles are organized into shared, calculator and access stylesheets.
- Passed the full local `npm test` regression suite and final build. Separate local profile browser journeys and entry scrolling/focus checks passed at 1440x900, 1366x640, 390x844 and 320x568. The primary localhost:5173 entry, no-save server calculation and logout also passed. No production records or paid AI calls were used for these redesign checks.

### Explicit project choice in AI prefill — 4 November 2026

- A live test showed an intermittent omission of an explicitly requested fixed-price project. Added a limited recovery rule for a complete affirmative choice sentence, retaining the exact source quote.
- Negated, undecided, conflicting or deferred monthly requests remain unanswered; existing explicit choices and manually edited answers remain protected. No prices or new business choices were added.

### Entry form scrolling — 4 November 2026 (deployed 4 November)

- The desktop form now scrolls within the right panel while the AOC branding and left visual remain visible. Short forms center safely; longer or expanded profile content remains reachable from top to bottom.
- Mobile/tablet layouts retain normal page scrolling with a fixed, readable brand header. Focused fields stay clear of the header, and calculator page scrolling is restored after entry.
- Checked eight viewport sizes, including short desktop windows and mobile landscape, with expanded profile review, keyboard focus, unchecked consent and successful calculator entry. No form content or calculation rules were changed. Deployed and checked on the AOC domain.

### Production preparation for optional profiles — 4 November 2026

- Added Supabase-backed profile endpoints using the same tested consent/reuse protocol as the offline adapter. The private profile table and restricted expiry-cleanup function are created; existing submissions and estimates are preserved.
- Profiles and estimate recording have independent, unchecked saving choices. Returning clients review saved details/facts before reuse; current and deliberately cleared answers remain protected.
- Profile ownership uses a private browser credential with only its digest stored. Email lookup is unavailable; conflicting revisions and cross-client overwrites are rejected. Selected removals and full profile deletion are supported.
- Prepared server-only Vercel flags and a sensitive cleanup secret. Profiles expire after the displayed configurable duration (30 days by default); daily protected cleanup is configured. Production does not use the offline file adapter.
- Passed protocol/security tests, real Supabase persistence/race/deletion/expiry tests, production-built desktop/mobile profile journeys and the full application regression suite. Synthetic profiles were removed after tests; no paid AI calls were made for this work.
- Verification/AOC approval remains paused. The Supabase-backed implementation is live and verified; port 5180 remains available for development. Details: [optional client profiles](features/OPTIONAL-CLIENT-PROFILES.md).

### Calculator output and editable marketing counts — 4 November 2026 (deployed 4 November)

- Tested workflow, agent and paid-advertising estimates on desktop/mobile against independent expected outputs. Draft builds, quoted totals, audit credits, payments, ROI, edits/clearing and unknown fees passed.
- Fixed supplied marketing channel/format counts being hidden outside Content & Social even though they could affect price. Existing fields now appear when supplied and remain editable after clearing. No pricing rules or new required questions were added.
- Evidence and sample outputs: [calculator output journeys](history/SYSTEM-AUDIT-2026-11-04.md#calculator-output-journeys--4-november-2026). Deployed and checked on the AOC domain.

### Document alignment — 4 November 2026 (deployed 4 November)

- Applied the 28–29 October fixed-price launch decision; monthly build programs remain deferred historical references.
- Included reusable training without a separate surcharge; preserved quoted project totals and separately purchased live training.
- Matched provider-savings eligibility, partial replacement unknowns and 50/50 payment rounding to the workbook.
- Corrected question-bank filtering; all 982 detailed questions match the reviewed source. Excluded payroll is unavailable to the form, AI and calculation API.
- Added the documented client-owned Make/direct-billing explanation and refreshed the short maintenance instructions.
- Passed the full regression suite, local profile tests, 10,000 payment splits, 144 independent quote/ROI cases and two synthetic real-provider AI tests. Details: [system audit and retest](history/SYSTEM-AUDIT-2026-11-04.md).
- No new prices or features were introduced by these corrections. Deployed and checked on the AOC domain.

### Historical optional client-profile trial — 4 November 2026

- Added a separate local trial for Task #9 with an unchecked **Remember my business details for next time** choice, review before reuse and a **Forget saved details** action.
- Expanded reuse beyond the entry details: clients can select existing app, access, connection and information-location facts to save, then review their source/date and confirm relevance before reusing them in a new estimate. Unknowns, prices and process-specific decisions are excluded.
- Manual and explicitly cleared answers are preserved; conflicting clients and stale profile updates are blocked. Contact updates preserve company facts, and fact updates preserve contact details. Selected old facts or the entire profile can be removed explicitly.
- Reused answers show **From confirmed profile**. Applying new facts marks previous results stale; arithmetic and pricing rules remain unchanged. Saving updates requires renewed unchecked consent.
- Uses an isolated local database and a private browser credential, with consent and field provenance recorded. Email alone cannot retrieve a profile. Production and Supabase storage were not changed. See [local trial instructions](features/OPTIONAL-CLIENT-PROFILES.md).
- Passed profile API and desktop/mobile browser checks, including opt-out, identity conflicts, preserved edits, separate clients, save-failure recovery, expiry, forgetting and calculation. The existing full regression suite also passed. Tests used synthetic details without paid AI or Supabase writes.

### Minimal interface redesign — 3 November 2026

- Rebuilt the entry page as a split layout: the AOC estimator identity and a restrained React Bits Aurora background sit on the left, with the business-details form on the right. Small screens stack the panels. All five fields, the saving choice and privacy information remain. Removed the **How it works** disclosure as requested.
- Refined the form with a soft neutral surface, a small heading icon, clear field focus states, and a distinct optional-saving section. Its validation, saving behavior and unchecked default remain unchanged.
- Retested the refined entry at desktop/mobile widths and verified submission, both saving choices, failure recovery, reduced motion and unavailable/lost WebGL. Layout checks passed from 320px through 1440px without horizontal overflow.
- Integrated the supplied Aurora JavaScript/CSS under `src/components/visuals/`, without a new npm package. It uses a static fallback without WebGL, stops animation for reduced motion, and releases graphics after entry. The original license is retained at `public/licenses/react-bits.txt`.
- Kept locally hosted **Inter** on the entry page, with its redistribution license included. The Worker serves the font as a binary asset.
- Restored the calculator's previous design: original typography, business-area choices, vertical desktop navigation, central form and estimate sidebar. Mobile retains its section selector and responsive layout.
- Allowed the calculator header to wrap on narrow phones so the brand, session controls and live context fit without overflow.
- Kept all existing editable and conditional questions, validation, AI prefill, voice/correction controls, calculations and downloads. No pricing or allowance rules changed.
- Kept entry styling scoped in `src/styles/access.css`; `public/journey.css` and `src/styles/base.css` continue to style the calculator. No UI framework or npm dependency was added.
- Local build, access/saving, pricing, voice/correction and complete desktop/mobile journey checks passed. Published application commit `55d77ee` and verified the live entry and calculator at 1440px, 390px and 320px. Full desktop/mobile calculation journeys, recalculation, summary downloads and reset cancellation passed with saving off and no paid AI calls. See [production test results](PRODUCTION-TEST-RESULTS.md).

### Simplified prospect journey

The seven-section estimator flow is retained, but each step now presents only the questions needed for an initial estimate. Supporting questions remain available through expandable optional sections.

- **Scope:** Core pricing inputs remain visible. Detailed routes, selected options, and the broader question bank are collapsed under **Review detailed scope**.
- **Apps:** The default view contains only the systems used and whether any system is old, customized, restricted, or uncertain. App actions, destinations, and additional connection details are optional.
- **Data:** Documentation readiness and preparation level remain visible because they affect price completeness. Ownership, locations, and conditional audit details remain optional.
- **Marketing:** Only material, category-specific pricing inputs remain visible. Brand, language, output volume, pages, and keyword details are available when relevant.
- **Potential value:** ROI entry is fully optional and collapsed by default under **Calculate potential value**. Prospects can continue without supplying internal costs or savings data.
- **Responsibilities and service:** The default view focuses on management ownership, permitted action mode, consequential-action controls when applicable, service tier, and confirmation. Detailed responsibility and coverage questions are optional.

### Progressive disclosure behavior

- Conditional review sections open when an answer makes them immediately relevant. Collapsed sections show an answered count when applicable so saved or prefilled information is not mistaken for an empty section.
- Conditional questions continue to appear when a prospect selects an answer that makes them relevant.
- Detailed fields were preserved rather than deleted, so they remain available for complex scopes and future audit work.
- The scope step uses a compact accordion for **Process complexity**, **Team and rollout**, and, when relevant, **Marketing scope**. Each group reports required-answer progress and exposes only one question group at a time.
- After the first step, the full introduction and testing notice become a compact **About this draft estimate** disclosure. The information remains available without competing with the active form.
- Optional disclosures now pair their purpose with a small status such as **Optional** or **3 answered**, making filled but collapsed information easier to recognize.
- Unanswered required fields now show a visible **Required** badge and highlighted control. The indicator clears when the answer is supplied, is exposed through native required and invalid states for assistive technology, and does not mark optional ROI or audit-detail questions.
- Moving between the seven form sections now uses a short fade-and-rise transition. The panel remains stable, and the transition is disabled when the visitor prefers reduced motion.

### Description-based form prefill

- While AI prefill is running, an accessible inline status card explains the current preparation stage, protects the submitted description from mid-request edits, and pauses duplicate continuation actions. Motion is disabled when the visitor prefers reduced motion.

- Organizing the prospect's description now prefills matching fields throughout Sections 3–7, not only the immediate scope step.
- Supported facts include named apps, team size, department count, cadence, documentation and preparation readiness, responsibility ownership, approval mode, handover, delivery mode, ROI quantities, and applicable marketing counts.
- Select values from the model are normalized to the form's stored values before being applied, so human-readable model wording cannot leave a choice visually blank.
- Management is derived consistently from the stated responsibility split. Prefilled values remain editable and are labeled **From your description**.
- Only explicitly stated facts are applied. Missing facts remain unanswered, classifications remain proposals for review, and an existing manually edited value is not overwritten by a later organizer result.
- The local organizer now scores the selected area's own route and field language, surfaces up to eight relevant category questions, and prefills explicit category quantities such as stated invoice or order counts without inventing values.

### Calculation and feasibility hardening

- Completed estimates now use `/api/journey/calculate` as the authoritative calculation path in both local Vite development and the packaged Worker.
- The server accepts only known fields for the selected area, validates numeric values, ignores client attempts to set derived management state directly, and derives management from the reviewed responsibility split.
- Calculation-sensitive choices are now checked against approved values. Unknown field IDs, invalid choices, fractional count fields, out-of-range complexity bands, and invalid confirmation values return a request error instead of reaching pricing.
- A browser-side calculation remains available only as a clearly labeled local preview when the server endpoint cannot be reached.
- The primary app-condition question now includes a direct **Restricted** option and exposes restriction, file-transfer, and alternative-approach follow-ups immediately.
- Known provider connection restrictions now hold the build and audit for connection review. Missing, restricted, unavailable, access-denied, or otherwise unclear essential information and described material data conflicts are treated conservatively as potential blockers.
- The final result repeats the recommended solution, connected responsibilities, included scope, and exclusions. Downloaded summaries record whether the calculation came from the server or local preview.
- The 2â€“4 week delivery indication is limited to simple or moderate Finance and Billing workflows. Other areas and more complex work require schedule review.

### Design and context

- The original rounded teal visual design remains in use.
- The header's former fixed preview badge was replaced with live local context based on the browser's IANA timezone.
- The badge displays an inferred city, live date, and local time and refreshes periodically.
- Location is inferred from timezone data; it does not request precise device location.

## Implementation locations

- `src/features/calculator/sections/ScopeSection.jsx`
- `src/features/calculator/sections/AppsSection.jsx`
- `src/features/calculator/sections/DataSection.jsx`
- `src/features/calculator/sections/MarketingFields.jsx`
- `src/features/calculator/sections/ValueSection.jsx`
- `src/features/calculator/sections/ServiceSection.jsx`
- `src/components/LiveContext.jsx`
- `src/styles/base.css`
- `tests/browser/test-react-ui.cjs`

## Behavior that must remain unchanged

- Pricing and ROI calculations stay deterministic; UI simplification must not remove or silently alter calculation inputs.
- Unknown, zero, no, and not applicable remain distinct states.
- Optional ROI fields must not be treated as zero when they are unanswered.
- Conditional feasibility and safety questions must still appear when triggered.
- Final estimates must be server-verified for production use; an offline/local fallback must stay visibly labeled as a preview.
- Existing values must remain editable and must survive moving a field between visible and expandable groups.
- Changing estimate inputs must continue to mark an existing result as stale until recalculated.
- The detailed question bank remains available for review and audit, even when hidden from the default prospect path.

## Verification completed

- Full automated test suite passed with `npm test`.
- Production Vite build completed successfully.
- Real-browser estimator journey passed using the synthetic pricing fixture.
- A complete 390 x 844 mobile browser journey passed from business-area selection through description, editable required fields, confirmation, server calculation, and overflow checks.
- UI guardrails verify that Scope exposes only its first required group, Apps starts with two controls, Data keeps its two estimate-sensitive controls visible, and the optional ROI step starts with no visible inputs.

## Accuracy review after simplification

The simplified form was re-audited against `public/journey-engine.js`. Fields that directly determine a complete price or can place standard pricing on hold are not labeled optional.

- Process complexity, people, teams, cadence, and handover are required-progress groups in Scope.
- Marketing capability, channels/formats where applicable, brands or websites, languages, SEO starting quantities, markets, and delivery scope remain in the required marketing group.
- Documentation readiness and preparation level remain visible because they affect preparation pricing or can require a bounded review.
- App connection condition remains visible; unanswered, unknown, customized, or older connections now prevent a complete build estimate instead of silently assuming standard integration pricing.
- Preparation level requires an explicit answer, including **Not sure** when appropriate. Substantial preparation keeps the result partial until separately bounded.
- A server-calculated managed-service path with incomplete monthly pricing receives **SERVER VERIFIED · PARTIAL** status even when the one-time build itself is complete; an unavailable server remains clearly labeled **LOCAL PREVIEW · VERIFY**.
- ROI stays optional. Missing ROI inputs result in an explicitly incomplete value calculation and do not change the build price.
- Evidence-only and audit-detail questions remain available in collapsed sections and are not deleted.

## Local AI organizer behavior

The conservative local organizer is now the default. It identifies named apps, likely routes, and clearly stated form facts while deliberately leaving pricing-sensitive complexity unanswered. The pre-React model path is retained as an optional enhancement: `/api/journey/analyze` uses the OpenAI Responses API, the existing structured-output contract, and `AOC_INTAKE_MODEL` (`gpt-5.4` by default) only when `AOC_AI_ORGANIZER_ENABLED=true` and a server-side `OPENAI_API_KEY` is configured. The packaged Worker remains the production implementation and Vite provides the equivalent local route. The secret is never sent to the browser. Missing configuration, network errors, billing failures, timeouts, empty responses, and malformed responses automatically fall back to local organization without blocking the prospect or losing the typed description.

## Future improvement opportunities

1. Measure completion rate, time per step, abandonment, and optional-section usage using privacy-conscious analytics.
2. Review whether the seven navigation steps can be grouped without weakening the existing scope and pricing model.
3. Consider letting prospects skip fully resolved groups after reviewing the clearly labeled description-derived values.
4. Add a concise completion summary before calculation so prospects can spot missing decision-sensitive information.
5. Test copy and field ordering with real prospects before removing any additional inputs.
6. Add accessible expand/collapse announcements and confirm full keyboard and screen-reader behavior.
7. Review the timezone-to-city label for ambiguous zones and provide a neutral fallback such as the timezone name.
8. Revalidate mobile layouts whenever new conditional fields or service tiers are introduced.

## Change checklist for future form work

Before shipping another form reduction or reorganization:

- Confirm whether each affected field is a direct price driver, derived driver, feasibility flag, scope evidence, or audit-only detail.
- Prefer conditional display or progressive disclosure before deleting a field.
- Preserve existing state keys and calculation contracts unless a deliberate migration is included.
- Add or update browser tests for the number of initially visible controls.
- Run `npm test` and the UI capture workflow.
- Check the empty, prefilled, unknown, zero, self-managed, managed-service, and mobile paths.
- Record the update in this file.

## Documentation reconciliation - 19 October 2026

- The description step now explicitly asks for apps, people, teams, frequency, volume, rules, exceptions, and the desired outcome while allowing unknown details to be skipped.
- The estimate gives a concrete next step: download the review summary and send it to the prospect's existing AOC contact. No contact address, payment, or checkout behavior was invented.
- The current React interface uses the journey analysis and calculation routes. Historical intake and transcription routes remain packaged for reconciliation, while voice stays disabled in the interface until its documented later phase.
- Release checks cover the documented $11,500 synthetic fixture; representative Finance, Content, SEO, and Other scenarios; approved complexity drivers; volume-only behavior; and availability of the retained intake routes without enabling voice in the React interface.
- Relevant implementation files: `src/features/calculator/sections/DescriptionSection.jsx`, `src/components/EstimateReport.jsx`, `worker/index.js`, `worker/intake-api.js`, `scripts/build/build-worker.cjs`, `tests/unit/test-journey.cjs`, `tests/integration/test-journey-worker.cjs`, and `scripts/build/validate-artifact.mjs`.

## Four-hour task update - 20 October 2026

This section records the completed correction pass against the current calculator specification. It is deliberately limited to Phase 1 behavior and does not pull gated entry, saved profiles, WordPress release, or voice into the working-calculator scope.

### Update 1 - Calculation verification and fallback

- A successful server calculation now displays **SERVER VERIFIED**. A server-verified incomplete result displays **SERVER VERIFIED · PARTIAL**.
- Local calculation remains available only as **LOCAL PREVIEW · VERIFY** when the calculation service is unavailable or unreadable.
- A server `4xx` validation rejection is now shown to the visitor and does not silently replace the last verified result with a local calculation.
- The result now exposes the itemized scope of a calculated AOC monthly service while retaining one combined monthly fee and keeping vendor subscriptions and usage separate.

### Update 2 - Scope and manual-edit preservation

- Changing business area after entering estimate information now requires confirmation because it clears the current estimate.
- Manual route selections and manually added detailed questions survive description reorganization.
- A manual route deselection remains deselected after reorganization, while obsolete organizer-only suggestions can still be replaced.
- Route selection now uses the full approved route list, including approved routes whose detailed follow-up bank is still awaiting completion.
- The route selector keeps the first approved choices available alongside already selected routes so a connected outcome can include more than one responsibility without becoming another full build.

### Update 3 - Unknown management state

- **Help me decide** no longer derives self-management when it comes from an organized description. Management and monthly service remain unknown until the visitor chooses AOC, client, or shared responsibility.
- Existing behavior remains unchanged for explicit AOC/shared management and explicit client self-management.

### Update 4 - Conditional form reduction

- Data-volume, material-format, and access-restriction follow-ups now appear only when preparation/readiness answers trigger them or when they already contain an answer.
- Service follow-ups for fallback, approval checkpoints, expert review, deadlines, and pending approvals now appear only when the reviewed answers make them relevant or when they already contain an answer.
- Client-retained responsibility details are no longer shown for an AOC-only responsibility choice.
- Detailed fields remain in the approved banks; this change affects presentation only and does not delete data or pricing inputs.

### Update 5 - Repeatable test order and regression coverage

- `npm test` now builds the client and packaged Worker before domain tests inspect generated artifacts, so the documented command works from a clean checkout after dependency installation.
- Browser coverage now verifies manual route preservation, triggered data/service questions, unknown management, local-preview labeling, monthly-service scope, successful server verification, server validation rejection, protected business-area changes, stale recalculation, the synthetic pricing fixture, and mobile overflow.
- The full local suite passes, including the deterministic model, Worker, retained intake contracts, Vercel adapters, browser journey, and packaged artifact validation.

### Update 6 - Orders and fulfillment icon

- Set **Orders, inventory, and fulfillment** to the requested `▦` icon glyph.
- Kept the change scoped to that business-area card; no other icons, labels, layout, or calculator behavior changed.
- Added browser coverage confirming that the card renders the requested glyph.

### Update 7 - Readable editorial typography

- Replaced the Manrope and DM Sans pairing with a single restrained **IBM Plex Sans** family across headings and interface text.
- Kept hierarchy through weight and size rather than a contrasting serif, improving cohesion across forms and estimate results.
- Added system-font fallbacks and preserved the existing layout, colors, calculator behavior, and responsive structure.

### Update 8 - Action feedback

- Added restrained hover and pressed transitions to **Start over**, step actions, primary actions, and the estimate-summary download.
- Kept navigation and selection behavior unchanged while making clickable actions feel more responsive.
- Disabled motion when the visitor has requested reduced motion at the operating-system or browser level.

### Update 9 - AI prefill configuration status

- Confirmed that typed description entry, fact extraction, editable prefilled answers, blank unknowns, manual-correction preservation, structured server validation, and local fallback are implemented and covered by the maintained tests.
- A live check of `https://aoc-estimate-calculator.vercel.app/api/journey/analyze` returned `{"localFallback":true,"mode":"local"}`. Production therefore uses the conservative local organizer until approved OpenAI credentials and the enable flag are configured in Vercel.
- Created the Git-ignored local `.env.local` configuration with `AOC_AI_ORGANIZER_ENABLED=true`, the documented model setting, and an intentionally blank `OPENAI_API_KEY`. A developer must add an approved key locally and restart Vite before testing the external provider.
- Secrets must never be recorded in this file, committed to Git, placed in `.env.example`, or exposed with a `VITE_` prefix. Vercel Production variables are separate from the local file and require a production redeploy.

### Update 10 - Vercel and custom-domain status

- Confirmed that the Git-connected production deployment is available at `https://aoc-estimate-calculator.vercel.app/`.
- Added `estimate.alwaysopencommerce.com` to the Vercel Production environment. Vercel reported **Invalid Configuration** because the requested DNS record has not been added at the domain provider.
- Live DNS checks showed that `alwaysopencommerce.com` uses GoDaddy nameservers while the main site remains pointed to WordPress. The required `estimate` CNAME must therefore be added in GoDaddy without changing the existing apex or `www` records.
- Custom-domain work was deliberately paused at the user's request. The Vercel URL remains the active calculator address, and the AOC subdomain must not be reported as complete until DNS, HTTPS, and the production smoke test pass.

### Confirmed delivery order

1. **Phase 1 — current priority, 18–29 estimated hours:** working typed calculator, description prefill, editable answers, deterministic pricing, subdomain setup, and testing.
2. **Phase 2 — 11–18 estimated hours:** gated entry, optional saved profiles with an unchecked consent checkbox, and WordPress release.
3. **Phase 3 — 4–8 estimated hours:** voice input after the typed calculator is stable.

These are planning estimates for Gino to review, not fixed deadlines. Later phases must not delay the working calculator. Numbered Hubstaff checklist evidence must be attached to the relevant future update before checklist completion is claimed.

### Remaining Phase 1 operational work recorded on 28 October (historical)

- Run the current fixed-project and monthly-program browser journeys on the AOC hostname.
- Capture final deployed desktop/mobile evidence for commercial configuration version `2026-10-21-commercial-v1`.
- Complete broader production AI-prefill scenarios and resolve any findings.
- Keep draft coefficients, monthly service amounts, SLA terms, and incomplete field mappings marked provisional until their business review is complete.

## Commercial and deployment reconciliation - 28 October 2026 (historical, before the latest source reconciliation)

- The AOC hostname now loads successfully over HTTPS; the earlier invalid-domain status above is historical.
- Production AI prefill is enabled and returned validated structured output using commercial configuration version `2026-10-21-commercial-v1`; the earlier local-only status above is historical.
- The active calculator supports the reviewed fixed-project route and the `$4,000` / `$7,000` / `$10,000` monthly build programs.
- Initial audit pricing is a separately quoted fixed amount, not 10% of the build. Eligible audit credit is applied once under the 30-calendar-day rule.
- Standard/Priority/Premier are working support names. Their prices, coverage, response targets, and allowances remain pending.
- The 18 October `$11,500` / `$1,150` / `$550` fixture remains historical regression context and is not current commercial acceptance evidence.
- Synthetic production API checks passed for fixed-project and monthly-program routes. A final deployed browser pass and current desktop/mobile evidence remain required.
