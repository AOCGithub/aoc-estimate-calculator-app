# Pricing and Form Maintenance

Updated: 28 October 2026

Steve approves the business changes. Gino updates the calculator, tests the affected results, and publishes the update.

## Current source baseline

The active commercial rule set is dated 21 October 2026. It was rechecked on 28 October against the live implementation task and the workbook as modified through 24 October. The current workbook does not approve additional package hours, support prices, coverage, or post-build maintenance pricing; those values remain pending.

The production AOC hostname and organizer are active. Production browser verification and publication records must still be refreshed whenever the commercial rules or form change.

## 1. Request a change

Send Gino the approved change:
- **Form:** identify the question or section, the replacement wording or answer options, and when it should appear or be required.
- **Pricing:** identify the price or rule, the approved replacement, and when it should apply.

Use Steve's implementation notes and the pricing workbook as the business references. **Editing the workbook does not automatically update the website.** Missing or unapproved amounts go back to Steve for review.

## 2. Apply the change

**Form changes:** update the relevant [form components](../src/components/sections/) or the question bank in the [reviewed workbook snapshot](../data/sheet-snapshot-20261018.json). Preserve existing field identifiers and check conditional questions, required fields, editable answers, and AI prefill.

**Pricing changes:** update the reviewed [commercial rules](../data/commercial-rules-20261021.json) for approved program fees and terms, and [commercial calculations](../public/commercial.js) for rule changes. The older snapshot retains the provisional build model and question bank. Regenerate the pricing and question-bank files with `node scripts/compile-approved.cjs`, update the version and expected test results, and compare the calculations with the workbook. Do not edit generated pricing alone.

## 3. Test and publish

1. Run `npm test`.
2. Check the affected form journey and estimates, including changed and cleared answers, applicable prices, audit credit, and ROI. Confirm manual corrections are preserved and unknown facts remain blank.
3. Push tested changes to GitHub's `main` branch. Vercel deploys automatically.
4. Confirm Vercel reports **Ready**, check both fixed-project and monthly-program results, and record the change and test outcomes in the [production test results](PRODUCTION-TEST-RESULTS.md).

Keep AI keys in Vercel's server settings.

## Current pricing status

The local implementation follows the 21 October commercial rules: separately quoted fixed audit; one eligible audit credit; fixed projects versus $4,000/$7,000/$10,000 monthly build programs; and route-specific costs/value. Program prices come from reviewed data, never a client-entered monthly fee. Standard/Priority/Premier project-support prices remain unpriced until approved data is supplied. Quoted project amounts, agreed hours/blend and audit records are references requiring AOC confirmation, not approval or billing performed by the calculator.

Unknown fees, allowances, credit eligibility, existing-agreement changes and benefit timing stay pending. No automatic package hours, universal agency rate, founder surcharge or deferred maintenance price is added. Provider/app savings count only confirmed eliminated costs once. The 18 October arithmetic remains historical regression coverage.

Publishing and deployed-version verification are separate steps. Existing production results still describe the earlier deployment until the tested update is released.

For developer setup and further technical details, see the [README](../README.md).
