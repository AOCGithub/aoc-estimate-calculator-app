# Pricing and Form Maintenance

Updated: 11 November 2026

Apply the approved source changes, test the affected forms and calculations, then publish the tested update.

## Current source baseline

The sources were rechecked on 11 November: the framework and agreement remain modified on 29 October; the workbook was modified on 5 November. The active commercial direction remains the 28-29 October baseline. Its fixed-price launch decision supersedes the older monthly-build instructions: fixed-price builds are active; monthly build subscriptions and their hour allowances are deferred. Optional monthly management stays separate, with missing prices left unknown. Reusable training is included; separately purchased live training uses its accepted quote. Clients own and pay for their Make accounts directly.

The production AOC hostname and organizer are active. Production browser verification and publication records must still be refreshed whenever the commercial rules or form change.

## 1. Request a change

Send Gino the approved change:
- **Form:** identify the question or section, the replacement wording or answer options, and when it should appear or be required.
- **Pricing:** identify the price or rule, the approved replacement, and when it should apply.

Use the implementation notes, [current framework](https://docs.google.com/document/d/1okDUVm5wE4MrPiFANlvQIrCJ1sC8omfXCssy37WqCdw/edit), [agreement](https://docs.google.com/document/d/15BxB-yzw8U1oP_1B2cpJu2EUgh3P8rnqKT5_ZqdT3dA/edit) and pricing workbook as the business references. Follow explicit supersession notes. **Editing the workbook does not automatically update the website.** Request missing amounts rather than inventing them.

## 2. Apply the change

**Form changes:** update the relevant [form components](../src/features/calculator/sections) or the question bank in the [reviewed workbook snapshot](../data/sheet-snapshot-20261018.json). Preserve existing field identifiers and check conditional questions, required fields, editable answers, and AI prefill.

**Pricing changes:** update the reviewed [current rules](../data/commercial-rules-20261029.json) and [commercial calculations](../public/commercial.js). The older snapshot retains the provisional build model and question bank; the current rules override included-training amounts. The compiler uses detailed question rows, excluding route-overview and excluded rows. Regenerate with `node scripts/build/compile-approved.cjs`, update the version and test expectations, and compare with the workbook. Do not edit generated pricing alone. Keep deferred planning values inactive.

## 3. Test and publish

1. Run `npm test`.
2. Check the affected form journey and estimates, including changed and cleared answers, applicable prices, audit credit, and ROI. Confirm manual corrections are preserved and unknown facts remain blank.
3. Push tested changes to GitHub's `main` branch. Vercel deploys automatically.
4. Confirm Vercel reports **Ready**, check fixed projects, optional management and changed/cleared answers, and record the results in the [production test results](PRODUCTION-TEST-RESULTS.md). Confirm deferred monthly programs remain unavailable.

Keep AI keys in Vercel's server settings.

For entry fields, the two independent saving choices, Supabase record lookup and repeatable live checks, see [entry and saved-data maintenance](GATE-AND-SAVED-DATA-MAINTENANCE.md).

## Current pricing status

The local implementation uses a separately quoted fixed audit, one eligible credit under the existing 30-day conditions, and fixed-project balance/payments. The credit is deducted once before splitting the balance into two payments; the first rounds to cents and the second reconciles the remainder. An explicitly entered project quote is preserved. Standard/Priority/Premier support prices stay unknown because the sources do not supply them. The calculator does not approve quotes, redeem credits or take payments.

Quote components accept explicitly quoted zero amounts; blank means unknown. For comparison, `Web Calculator Test!B59,B68,B71` still need reconciliation with the written incremental-cost and accepted-quote rules. The app follows those written rules rather than adding retained unrelated costs to ROI or replacing an accepted quote with a draft estimate.

Unknown fees, credit eligibility and existing-agreement changes stay pending. Provider savings apply only to marketing areas 6–10; app savings apply where relevant. Partial replacement requires both the current total and the eliminated amount. Missing figures leave net ROI/payback unknown; savings cannot exceed current costs. The 18 and 21 October models remain historical regression coverage.

Publishing and deployed-version verification are separate steps. Existing production results still describe the earlier deployment until the tested update is released.

For developer setup and further technical details, see the [README](../README.md).
