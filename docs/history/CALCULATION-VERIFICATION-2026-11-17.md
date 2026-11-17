# Calculation verification — 17 November 2026

**Result: all 45 checked coefficients and the tested scope/build calculations match the current workbook. Ordinary quote, payment and ROI checks pass against the written rules. There is no complete match to every workbook test formula: two existing test-reference differences and one newly reproduced incomplete-date difference remain.**

No application logic, configured prices, workbook cells or database records were changed during this audit. No paid AI requests were made.

## Source versions and method

[Pricing workbook](https://docs.google.com/spreadsheets/d/1vUDbKYWQPTaVIvJEYGzY5pVDCt0n369Ywel0tPk9M7s/edit?usp=drivesdk) · [Pricing framework](https://docs.google.com/document/d/1okDUVm5wE4MrPiFANlvQIrCJ1sC8omfXCssy37WqCdw/edit?usp=drivesdk) · [Agreement / SOW / SLA](https://docs.google.com/document/d/15BxB-yzw8U1oP_1B2cpJu2EUgh3P8rnqKT5_ZqdT3dA/edit?usp=drivesdk)

| Source | Read for this audit | Last modified in Drive |
| --- | --- | --- |
| Always Open Commerce — AI Commerce Pricing Calculator — Working | 17 November 2026 | 2026-11-05 |
| Always Open Commerce — AI Commerce Pricing Framework — Working v1 | 17 November 2026 | 2026-10-29 |
| Always Open Commerce — AI Commerce Agreement, SOW & SLA — Working Draft v0.1 | 17 November 2026 | 2026-10-29 |
| Always Open Commerce — AI Commerce Calculator — Gino Implementation Task | 17 November 2026 | 2026-10-21 |

The source modification dates have not changed since the 11 November review. Current values and formulas were nevertheless read again through the Google connector. Bounded reads included Workflow Automation, AI Agents, Shared Rules, Web Calibration, Web Calculator Test, Audit & Project Quote, Monthly Service, Data Readiness and the output guide. The reference files were read-only.

Expected amounts were calculated independently from those current values/formulas and compared with both the local engine and the calculation modules freshly downloaded from the deployed AOC website. Worksheet test inputs were not populated or changed, so the numerical comparisons below are independent evaluations of the source rules, not screenshots of Google Sheets recalculating filled-in cells.

## Results

| Check | Result | What it establishes |
| --- | --- | --- |
| Configured coefficients | 45/45 matched | Core, agent, preparation, connection, control, rollout, training, range and marketing/delivery values agree with their source cells. |
| Scope/build combinations | 960/960 passed on local and downloaded deployed engines | All 12 areas; 16 workflow step/variation combinations and 64 agent step/variation/decision combinations per area. |
| Component boundaries | 21/21 passed on both engines | People 4/5/15/16; departments 1/2/3/4; systems 1/3/4/6; duplicate apps; training audiences; readiness; consequential versus draft-only work. |
| Invalid classification inputs | 8/8 passed on both engines | Missing, zero, out-of-range and fractional bands do not produce a supported classified build. |
| Current-source audit | 104 checks passed | Includes the earlier 96 equal-band scenarios, quote/credit boundaries, unknowns and reproductions of the two existing source differences. |
| Independent quote/ROI regressions | 144 scenarios passed | Project totals, credit, payment splits, investment, ongoing costs and ROI. |
| Payment rounding | 10,000 cases passed | First payment rounds to cents; second payment reconciles the remaining balance. |
| Explicit commercial samples | 14/14 passed on both engines | Amounts and missing-answer behavior shown below. |
| Downloaded website files | 7/7 byte-identical to tested local files | Pricing, engine, commercial, validation and approved-bank modules currently served by the website. |
| Vercel and retained Worker integration regressions | Passed locally | Calculation handlers, validation and origin guards. These were not authenticated production-server requests. |
| Authenticated live calculation API | Not run | The user could not complete Google CAPTCHA. The test window was closed before entry; zero live calculation requests were made. |

Counts from separate suites overlap. The 104-check audit includes the earlier 96 equal-band scenarios; they are not 104 additional unique business journeys. The 960-case matrix is an expanded calculation check, not 960 separate client submissions or AI classifications.

## Scope classification and build breakdown

The current `Web Calculator Test!B46` formula derives the level from the maximum applicable band: steps and variations for workflows; steps, variations and decisions for agents. Valid levels are Simple, Moderate, Complex and Advanced. Examples checked: a workflow with steps 1 and variations 4 is Advanced; an agent with steps 1, variations 2 and decisions 4 is Advanced.

These tests verify the calculation after scope inputs are supplied. They do not certify AI judgment on arbitrary descriptions. The workbook itself describes classification as case-specific rather than one universally proven score. This audit covers the implemented workflow/agent calculator, not every separate workspace/migration scenario tab in the workbook.

Controlled matrix inputs: six unique supported apps; seven people; three departments; limited documentation; approved consequential actions; included group training; no accepted implementation quote. Marketing cases also use three capabilities, four channels, three formats, two brands/sites and two languages. SEO cases use 20 initial pages, 30 keywords and two markets. These are synthetic inputs, not configured client quotes.

### Complex-band totals across all 12 areas

| Business area | Expected workflow | Website-code workflow | Expected agent | Website-code agent |
| --- | ---: | ---: | ---: | ---: |
| Finance & Billing | $12,000.00 | $12,000.00 | $15,500.00 | $15,500.00 |
| Orders & Fulfillment | $12,000.00 | $12,000.00 | $15,500.00 | $15,500.00 |
| Customer Service & Returns | $12,000.00 | $12,000.00 | $15,500.00 | $15,500.00 |
| Sales & Customer Relationships | $12,000.00 | $12,000.00 | $15,500.00 | $15,500.00 |
| People & HR | $12,000.00 | $12,000.00 | $15,500.00 | $15,500.00 |
| Back-office Administration | $12,000.00 | $12,000.00 | $15,500.00 | $15,500.00 |
| Storefront & CRO | $15,150.00 | $15,150.00 | $18,650.00 | $18,650.00 |
| Content & Social Publishing | $15,150.00 | $15,150.00 | $18,650.00 | $18,650.00 |
| SEO & GEO | $15,980.00 | $15,980.00 | $19,480.00 | $19,480.00 |
| Email & Lifecycle Marketing | $15,150.00 | $15,150.00 | $18,650.00 | $18,650.00 |
| Paid Advertising | $15,150.00 | $15,150.00 | $18,650.00 | $18,650.00 |
| Other / Multi-area | $12,000.00 | $12,000.00 | $15,500.00 | $15,500.00 |

Every row matched. The full [960-case comparison](CALCULATION-SCOPE-CASES-2026-11-17.csv) includes the actual local and downloaded-engine outputs, mixed bands and expected ranges.

### Finance workflow, Complex band: itemized example

| Component | Workbook source | Expected | Website-code amount |
| --- | --- | ---: | ---: |
| Core complex process build | Workflow Automation!B7 | $6,000.00 | $6,000.00 |
| Bounded source preparation | Workflow Automation!B13 | $2,000.00 | $2,000.00 |
| Additional supported systems beyond 3 | Workflow Automation!B17:B18 | $1,500.00 | $1,500.00 |
| Consequential-action safeguards | Workflow Automation!B19 | $1,500.00 | $1,500.00 |
| People / adoption rollout | Workflow Automation!B22 | $500.00 | $500.00 |
| Departments beyond two | Workflow Automation!B21 | $500.00 | $500.00 |
| Training & handover | Workflow Automation!B20 | $0.00 | $0.00 |
| **Total** | Sum of components | **$12,000.00** | **$12,000.00** |

That example has a $9,600–$15,000 indicative range using Shared Rules!B17:B18 (−20%/+25%, rounded to $100). The corresponding Complex agent adds $3,500 from AI Agents!B33, giving $15,500. The Paid Advertising example adds $3,150 of applicable marketing scope, giving $15,150; the SEO example adds $3,980, giving $15,980. Included reusable training has no separate surcharge.

### Source-calibrated base bands

| Band | Workflow core | Additional agent work | Source |
| --- | ---: | ---: | --- |
| Simple | $1,500.00 | $1,000.00 | Workflow Automation!B5; AI Agents!B31 |
| Moderate | $3,500.00 | $2,000.00 | Workflow Automation!B6; AI Agents!B32 |
| Complex | $6,000.00 | $3,500.00 | Workflow Automation!B7; AI Agents!B33 |
| Advanced | $9,000.00 | $5,000.00 | Workflow Automation!B8; AI Agents!B34 |

The workbook labels these build/calibration amounts provisional. A numerical match does not turn them into final accepted customer quotes. Unknown monthly support/management prices remain unknown; no rates were invented for this audit.

## Commercial examples

All values below are synthetic test inputs. The baseline accepted quote is $11,500, with a $1,250 paid eligible audit, 40 monthly staff hours, an hourly staff cost of $50, no displaced costs and no added monthly costs. This produces 32 hours of freed capacity, valued at $1,600/month. That is staff-time value, not an assertion of $1,600 in cash savings.

| Scenario | Expected values | Downloaded website-code result |
| --- | --- | --- |
| Accepted quote | build: 11500; audit: 1250; projectBalance: 10250; firstProjectPayment: 5125; secondProjectPayment: 5125; initialSpend: 11500; capacity: 1600; net: 1600; payback: 7.1875 | Matched all listed values |
| Agreement payment example | build: 10000; projectBalance: 9000; firstProjectPayment: 4500; secondProjectPayment: 4500; initialSpend: 10000; payback: 6.25 | Matched all listed values |
| Explicit zero implementation component | build: 1000; buildQuoted: true; projectBalance: 750; firstProjectPayment: 375; secondProjectPayment: 375; initialSpend: 1000; payback: 0.625 | Matched all listed values |
| Odd-cent project balance | projectBalance: 10000.05; firstProjectPayment: 5000.03; secondProjectPayment: 5000.02 | Matched all listed values |
| Credit on day 30 | projectBalance: 10250; firstProjectPayment: 5125; secondProjectPayment: 5125 | Matched all listed values |
| Credit on day 31 | projectBalance: 11500; firstProjectPayment: 5750; secondProjectPayment: 5750 | Matched all listed values |
| Previously used credit | projectBalance: 11500; firstProjectPayment: 5750; secondProjectPayment: 5750 | Matched all listed values |
| Cleared implementation quote | buildQuoted: false; provisionalBuild: 11000; projectBalance: Pending; firstProjectPayment: Pending; secondProjectPayment: Pending; payback: Pending | Matched all listed values |
| Missing team time | capacity: Pending; net: Pending; payback: Pending | Matched all listed values |
| Missing added software cost | recurring: Pending; net: Pending; payback: Pending | Matched all listed values |
| Unpriced AOC management | monthly: Pending; net: Pending; payback: Pending | Matched all listed values |
| Negative monthly benefit | capacity: 1600; net: -400; payback: Pending; yearNet: -16300 | Matched all listed values |
| Partial software removal without current total | software: Pending; cash: Pending; net: Pending; payback: Pending | Matched all listed values |
| Purchased live training | build: 11800; projectBalance: 10550; firstProjectPayment: 5275; secondProjectPayment: 5275; payback: 7.375 | Matched all listed values |

Quote and credit checks reference Audit & Project Quote!B20:B23. The zero-component sample uses preparation $1,000, implementation $0 and an eligible audit credit of $250: project balance $750, then $375/$375. The odd-cent sample leaves a $10,000.05 balance and splits $5,000.03/$5,000.02.

## Differences requiring follow-up

### A. Draft build versus accepted quote — previously recorded

`Web Calculator Test!B68/B71` reference the draft build in B57 for investment/payback. The written agreement uses the accepted combined project price. With a $11,000 draft, $11,500 accepted quote and $1,600 net monthly value, the app uses $11,500 and 7.1875 months; the worksheet draft reference gives $11,000 and 6.875 months. The app follows the written agreement. Reconcile the worksheet reference before claiming complete formula parity.

### B. Combined retained fees versus incremental ROI costs — previously recorded

`Web Calculator Test!B59` references Monthly Service!B18 (combined existing/new management), whereas Monthly Service!B19 and the written rules distinguish the added fee/vendor cost used for this workflow's ROI. An isolated in-memory fixture used retained fees $1,000, new management $200 and new vendor cost $50: app recurring added cost $250 and monthly net $1,350; using the combined fee yields $1,250 and $350. The $200 is only a test fixture; it was not configured or sent as a live customer fee.

### C. Expired audit window with missing historical dates — newly reproduced

As of 17 November: audit sent 1 October, credit deadline 31 October, quoted/paid audit $1,250, accepted project quote $11,500, but acceptance and first-payment dates left blank.

| Output | Workbook | Local and downloaded website code |
| --- | --- | --- |
| Credit eligibility | Pending: COUNT(B5:B9) is not five | Expired |
| Audit credit | Unknown / blank | $0 |
| Project balance | Unknown / blank | $11,500 |
| First project payment | Unknown / blank | $5,750 |
| Second project payment | Unknown / blank | $5,750 |

The worksheet checks missing fields first in Audit & Project Quote!B11:B12. The app checks an expired deadline before requiring both historical dates. A blank date does not establish whether the event happened, so this is an unresolved missing-answer behavior difference. It needs a targeted decision/correction and retest before claiming parity for incomplete historical records. No app fix was applied during this audit.

## Test limits and remaining action

- Resolve difference C and reconcile worksheet test references A/B. Repeat only the affected cases after a change; the passing coefficient and ordinary arithmetic checks do not need wholesale repetition.
- A real authenticated production-API comparison remains untested in this run because human CAPTCHA completion was unavailable. Downloaded website code was tested, and local Vercel/Worker regressions passed; neither is labelled a fresh live API pass.
- This calculation audit made no real-provider AI requests and does not test speech recognition, arbitrary AI scope classification or physical phones.
- No customer records, backups, workbook edits, configured-price changes or application deployment were made for this audit.

## Reproduction and retained evidence

Established repository commands: `npm run test:domain`, `npm run test:vercel`, `npm run test:worker`. All passed on 17 November. The established pricing regressions were also executed with the freshly downloaded deployed modules.

Local audit evidence is retained under the Git-ignored artifacts folder: `pricing-source-evidence-20261117.json`, `pricing-document-logic-results-20261117.json`, `independent-calculation-results-20261117.json`, `commercial-samples-results-20261117.json`, `published-calculation-parity-20261117.json`, and `live-calculation-results-20261117.json`. Source cells, inputs, outputs and the complete classification/build matrix are summarized in this report and the adjacent CSV. Raw source-document content and browser credentials are not published.
