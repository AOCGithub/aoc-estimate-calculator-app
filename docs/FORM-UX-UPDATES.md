# Form UX Updates

Last updated: 21 October 2026
Status: Implemented and verified locally; deployment tasks remain

## Purpose

This note records the recent prospect-facing form improvements so future work can build on them without restoring unnecessary fields or changing pricing behavior by accident.

## Completed changes

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

### Description-based form prefill

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

- `src/components/sections/ScopeSection.jsx`
- `src/components/sections/AppsSection.jsx`
- `src/components/sections/DataSection.jsx`
- `src/components/sections/MarketingFields.jsx`
- `src/components/sections/ValueSection.jsx`
- `src/components/sections/ServiceSection.jsx`
- `src/components/LiveContext.jsx`
- `src/styles.css`
- `tests/test-react-ui.cjs`

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
- Relevant implementation files: `src/components/sections/DescriptionSection.jsx`, `src/components/EstimateSidebar.jsx`, `worker/index.js`, `worker/intake-api.js`, `scripts/build-worker.cjs`, `tests/test-journey.cjs`, `tests/test-journey-worker.cjs`, and `scripts/validate-artifact.mjs`.

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

### Remaining Phase 1 operational work

- Complete the deferred GoDaddy CNAME for `estimate.alwaysopencommerce.com`, wait for Vercel to report **Valid Configuration**, and verify HTTPS before using the custom address.
- Run the documented synthetic smoke test against the intended production URL and confirm the server-verified result.
- Capture deployed desktop/mobile evidence and test the optional OpenAI organizer with approved server-side credentials if it is enabled for staging.
- Add approved OpenAI credentials and the organizer enable flag to Vercel Production, redeploy, and verify known facts, blank unknowns, and preserved manual corrections before marking external AI prefill complete.
- Keep draft coefficients, monthly service amounts, SLA terms, and incomplete field mappings marked provisional until their business review is complete.
