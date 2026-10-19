# Always Open Commerce — AI Commerce Calculator
## Gino implementation task · 18 October 2026

### Task summary
Build a production-ready AOC estimate experience from the current working preview and Google Sheet. Visitors choose a business area, describe their process once, review prefilled details, answer only material gaps, and calculate an indicative build, paid audit, optional monthly service and potential ROI. Preserve the existing pricing rules and question banks. A format change must never erase pricing logic.

Owner: Gino. Business decisions and pricing approval: Steve. Status: task prepared; not posted or sent. No deadline has been assigned.

Working preview: https://aoc-estimator-preview.always-open-9605.chatgpt.site
Pricing/rules workbook: https://docs.google.com/spreadsheets/d/1vUDbKYWQPTaVIvJEYGzY5pVDCt0n369Ywel0tPk9M7s/edit
Task document: https://docs.google.com/document/d/1ZR-7dAayjtmejgo6GQrtJeI3FSj3kGjNeq_7zIuEPMA/edit

The preview currently has public access inherited from its previous version. It is for testing, has no prospect gate, and must not be presented as the qualified client production calculator. Use synthetic data. The previous handoff's owner-private description is superseded. Do not expose internal pricing controls, source exports, credentials or client records through a public page.

### What is already available
The rebuilt preview has the seven-section journey, all 12 approved business areas, the category question banks captured from the workbook, searchable app suggestions, editable answers, narrative extraction into shared/category fields, draft deterministic build pricing, workflow monthly tier calculations, optional ROI, audit credit rules and a downloadable estimate summary. Voice is intentionally disabled. It does not save prospect profiles.

The Sheet has dedicated Sections 4–7, preserved category and pricing tabs, Web Calibration, Web Calculator Test, and Web Logic Mapping. The web uses a versioned snapshot rather than reading live Sheet cells. Editing the Sheet does not automatically deploy new web logic.

The detailed category banks contain about 1,000 unique fields across 12 areas. Many are scope evidence rather than independent price multipliers. Some category questions and numeric mappings still need review. In particular, Finance & Billing has a detailed invoice bank, while several other finance routes remain marked for detailed completion. Do not interpret a locked review pass as proof every coefficient is calibrated.

### Required experience
1. Choose business area. Show the 12 approved choices from Business Areas & Prompts; no technical service selection first. Workspace setup is outside the main automation/agent entry flow.
2. Describe the work. Use that category's explainer prompt. Support typing first. Explain that apps, people, teams, frequency, volume, rules, exceptions and the desired outcome are useful but unknown details may be skipped. Mention B2B, B2C or both where relevant.
3. Review process and scope. Recommend workflow or agent with a reason, not an automatic commitment. Populate the applicable category questions from the description. Show only relevant questions; retain the rest in the bank. One connected business outcome can contain several tasks, channels or helper scenarios without becoming separate full builds.
4. Your apps and software. Reuse named apps. Capture required actions/accounts/locations only when material. Search suggestions are not compatibility guarantees. Customized, older or restricted products trigger action-level verification and possible alternative scope before an audit is sold.
5. Your documents and data. Four core concepts: instructions/examples, where information lives, preparation needed, and who prepares missing information. Targeted material follow-ups only. Preserve the detailed audit bank without making it a mandatory estimate form.
6. Time, costs and potential value. Optional monthly hours, blended hourly cost, provider costs actually replaced in applicable marketing scopes, and app costs actually eliminated. Unknown is not zero. Separate capacity value from cash savings and new recurring costs.
7. Responsibilities and ongoing service. Use the approved tab's seven core definitions and five conditional definitions. Distinguish client tasks, AOC expert review, permitted routine actions, business impact, response need and operating window. Calculate one monthly service fee; no customer-entered test amount or separate agent-management surcharge.
Then show the estimate and next step. These seven sections are a framework, not a requirement to answer seven separate interviews. A detailed explanation should leave few gaps.

### Shared rules that must survive
Section 2 can prefill Sections 3–7. Ask only missing, contradictory, unclear or decision-sensitive information. Ask now only if it changes estimated scope, price or feasibility; otherwise defer to the paid audit. Preserve manual edits when reanalyzing and remove obsolete AI-derived facts. Do not silently overwrite one estimate's scope or saved company profile.

Missing, unknown, explicit No, zero and not applicable are different states. Do not choose management, service level, provider savings, software costs, people counts or source readiness without evidence. Explain any assumptions. AI may propose a classification with a reason; the visitor must be able to correct it.

There is no restored $3,000 retainer. Build is a fixed scope-based estimate; monthly service is separately explained. Do not charge per helper Make scenario, per checkbox or per separate piece of a connected Content Machine. Shared preparation, base management and training must not be duplicated when scopes overlap. The current demo estimates one connected scope at a time; multi-estimate portfolio deduplication is further work.

### Pricing and ROI implementation
Keep calculations deterministic and versioned. AI extracts facts and explains; it must not invent a price or decide a discount. Every active numeric input needs a source, status and test. Use Web Logic Mapping to classify each field as direct driver, derived driver, feasibility flag, scope evidence or audit-only detail. Where no numeric mapping is calibrated, mark review needed rather than quietly inventing a fee.

Build coefficients remain provisional. Agent build additions are proposed amounts. Monthly workflow test rates are retained draft demo coefficients now recorded in Web Calibration. Monthly agent upkeep is deliberately unpriced: previously withdrawn flat $100/$200/$400 agent add-ons must not reappear. Agent review work belongs inside the single monthly service fee once its scope/rates are calibrated. Do not fill missing official Monthly Service prices with warehouse-only fixture values.

Standard/Priority/Critical names and differences are established. Exact monthly amounts, human coverage windows, response targets, staffing, small-change allowances and final SLA terms still need commercial review. Existing agreement numbers are proposed. Response means a qualified person starts investigating, not restoration. Automated monitoring is not continuous human attendance. Critical 24/7 promises require staffed eligibility. Significant new rules, systems, authority or architecture are separately scoped. Ad hoc direction: $150/hour with a $150 minimum per ticket, subject to availability; do not invent billing increments or guarantees.

ROI formulas for eligible workflow illustrations:
- Hours freed = current monthly team hours × 80%; retained = × 20%. This is an audit-validated planning assumption, not a savings guarantee or payroll reduction.
- Capacity value = hours freed × blended internal hourly cost.
- Cash savings = provider fees actually removed + app costs actually eliminated. Count only comparable replaced work; exclude fees that remain.
- Ongoing costs = AOC monthly service + incremental app/usage costs.
- Net monthly economic benefit = capacity value + cash savings − ongoing costs.
- First-year investment = build + 12 operating months of ongoing costs.
- First-year gross benefit = 12 × monthly capacity and cash benefit.
- First-year net benefit = gross benefit − investment.
- Payback = build ÷ positive net monthly benefit, from operation. If net is nonpositive, say no payback under these assumptions. If material inputs are unknown, show known components and incomplete ROI.
- Workspace setup does not automatically inherit the workflow 80/20 assumption. Revenue uplift is not fabricated in the baseline.

Audit = 10% of the preliminary build estimate. Audit findings may change scope, price or feasibility. Full eligible audit payment is credited once toward the build when proceeding and paying within the agreed 30-day window from findings/proposal. It is part of the build total when credited, not an additional investment. Do not enable checkout for a known blocked approach. An unknown app connection is not automatically impossible, but must be reviewed before audit purchase.

Output must include recommended solution, connected scope, build breakdown/range/status, audit and credit terms, estimated delivery, AOC monthly fee and scope, separate vendor costs, ROI where supported, assumptions, feasibility concerns, what is excluded, client requirements and the next step. The 2–4-week window is a preliminary smaller billing/workflow example, not a universal delivery promise.

### Recommended production architecture, in order
1. Separate AOC web app and server API on an AOC subdomain, linked from WordPress.com. This is the recommended initial delivery: independent deployments, controlled backend calculation and access, reusable structured review screen.
2. The same app embedded in WordPress.com with an iframe, after testing the actual plan and hosting features. Include accessible link-out fallback, responsive height messaging, an origin allowlist and a deliberate authentication strategy.
3. A WordPress plugin/block plus server routes if the team's operational requirements justify tighter WordPress coupling. Confirm actual plugin deployment capability first.
4. ChatKit as the whole estimator only if a prototype proves the review/edit/calculation UX is simpler. Recommended ChatKit use is contextual help beside the structured form, rather than replacing it with another long interview.

Do not publish a Google Sheet as the browser's pricing database or paste secret keys into page markup. The workbook is the controlled business reference. Publish a reviewed, versioned configuration to the server; validate inputs and recompute estimates server-side before saving or accepting an audit purchase. Browser calculations may provide responsive previews but are not authoritative for a transaction.

WordPress.com's current Custom HTML guidance requires a paid plan with activated hosting features for iframe/script/form code. Verify AOC's actual plan and test a draft page. OpenAI's current ChatKit docs support a custom server integration; verify current supported APIs before implementation. There is no automatic connection from a ChatGPT Project or custom GPT to this website. AOCGPT requires a curated, client-safe server-side knowledge set with defined permissions.
Official references checked 18 October 2026:
https://wordpress.com/support/wordpress-editor/blocks/custom-html-block/
https://developers.openai.com/api/docs/guides/chatkit
https://developers.openai.com/api/docs/guides/custom-chatkit

### Implementation order
Phase 1 — Read and reconcile. Obtain source and workbook access; run the included tests. Preserve the previous models. Review every Web Logic Mapping status and propose missing numeric mappings separately from simple UI fixes. Do not expand the first release into a whole-business implementation.
Phase 2 — Typed staging calculator. Implement the seven-section flow, conditional visibility and editable review with a versioned deterministic server calculation. Keep all forms accessible and responsive; prevent duplicate or irrelevant questions. Changes after calculation must mark results stale until recalculated.
Phase 3 — AI prefill. Use structured outputs with allowed field IDs, exact evidence quotes for business facts and separate proposed inferences. Validate server-side, ignore instructions embedded in descriptions, keep secrets server-only, rate-limit requests and handle timeouts with text preserved. Use approved existing credentials through secure deployment configuration; do not email or commit keys.
Phase 4 — Access gate. Before client access collect name, company, website, role and business email; no LinkedIn and no inbox access. Start with business email verification and AOC eligibility review. Block or revoke spam, competitors or unsuitable use under the stated policy. Do not claim an email address alone verifies a business. No marketing, retargeting or unsolicited sales follow-up from calculator submission; user-requested calls/audits remain available. Never rely on a hidden URL as access control.
Phase 5 — Voice. After typing works, implement visible dictation into the same description box, permission/error states and editable transcript. Decide streaming versus record-and-transcribe explicitly: a post-recording transcript is not live dictation. Verify microphone denial, silence, stopping, retries and supported browsers. Voice failure must not prevent typing.
Phase 6 — Optional profile reuse. Plan this separately. Saving is optional with explicit purpose/consent; no save means session-only. Reuse relevant company facts after confirmation. A database is appropriate if accounts, estimate history and saved profiles are implemented; Supabase is an option, not a locked decision. Do not create one spreadsheet tab per client. Record field provenance and avoid silent cross-client access or profile overwrites.
Phase 7 — WordPress integration and release checks. Connect the chosen hosting approach, gate, backend and configuration release process. Provide test access and evidence to Steve before client rollout. Keep website help chat, broader RAG and company workspace setup as separately scoped integrations.

### Acceptance tests and deliverables
Demonstrate an empty start; all 12 areas; finance invoices versus supplier bills; a connected multi-task scope; content across blog/company LinkedIn/personal LinkedIn; SEO initial versus recurring work; and another process with no exact preset. Only relevant category questions should appear. Log actual unanswered prompt counts and duplicates rather than imposing an arbitrary cap.

Show that changing people, departments, training, rule variation, app count, channels and chosen coverage affects the intended derived scope or explicit review flag. App volume alone must not multiply the build fee. Verify numerical equality between Sheet test and web model, including after removing values. Test self-managed $0 versus unknown, ordered draft workflow tiers, agent monthly unpriced, legacy/custom hold, explicit zero, partial provider replacement, missing usage cost, negative ROI and one-time audit credit.

Included arithmetic fixture (synthetic, not a quote): complex workflow, limited sources, six apps, financial-action controls, three people/two teams, group handover, monthly frequency, Priority draft service, 40 hours at $50/hour, no replaced fees and confirmed zero added usage. Expected build $11,500; audit $1,150; monthly $550; freed 32 hours; retained 8; capacity $1,600; net monthly $1,050; first-year investment $18,100; gross benefit $19,200; net $1,100; payback about 10.95 months. This verifies arithmetic, not approved pricing.

Return: staging link, source access/export, configuration version, field-to-rule mapping with open gaps, test results, browser/mobile screenshots, deployment instructions, remaining business decisions and a production launch checklist scoped to this calculator. Do not report voice, gate, live Sheet sync, saved profiles or final SLA pricing as complete until tested.

### Source orientation and current verification limits
src/App.jsx + src/components + src/hooks/useEstimator.js: React seven-section UI and centralized journey state.
index.html + public/journey.css: Vite entry point and retained visual system. legacy/journey-pre-react.js is retained only for reconciliation.
public/approved-bank.js: compiled category/shared field definitions and app suggestions.
public/journey-engine.js + approved-pricing.js + engine.js: deterministic draft model, preserving core pricing coefficients.
public/journey-contract.js + worker/journey-api.js: field schema, evidence validation and extraction route.
data/sheet-snapshot-20261018.json: internal captured rules and question banks; do not serve it as a public file.
scripts/compile-approved.cjs: regenerate bank/pricing from the reviewed capture.
scripts/build-worker.cjs: packages the React client and Worker assets; live voice remains disabled.
test-journey.cjs and test-journey-worker.cjs: arithmetic/unknowns/tiers/schema and React-asset Worker tests.

Tests cover deterministic arithmetic, data/field validation, missing-provider fallback and mocked AI responses. Native Sheet formula outputs were compared against the JS model. Real browser/mobile usability and live provider extraction need Gino verification; these are not claimed complete. Existing legacy engine, model, department and question files remain in source for reconciliation.
