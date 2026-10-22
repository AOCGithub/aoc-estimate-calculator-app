# Pricing and Form Maintenance

Updated: 22 October 2026

Steve approves the business changes. Gino updates the calculator, tests the affected results, and publishes the update.

## 1. Request a change

Send Gino the approved change:
- **Form:** identify the question or section, the replacement wording or answer options, and when it should appear or be required.
- **Pricing:** identify the price or rule, the approved replacement, and when it should apply.

Use Steve's implementation notes and the pricing workbook as the business references. **Editing the workbook does not automatically update the website.** Missing or unapproved amounts go back to Steve for review.

## 2. Apply the change

**Form changes:** update the relevant [form components](../src/components/sections/) or the question bank in the [reviewed workbook snapshot](../data/sheet-snapshot-20261018.json). Preserve existing field identifiers and check conditional questions, required fields, editable answers, and AI prefill.

**Pricing changes:** transfer approved workbook changes into the reviewed snapshot and affected calculation rules. Regenerate the pricing and question-bank files with `node scripts/compile-approved.cjs`, update the configuration version and expected test results, and compare the calculations with the workbook.

## 3. Test and publish

1. Run `npm test`.
2. Check the affected form journey and estimates, including changed and cleared answers, applicable prices, audit credit, and ROI. Confirm manual corrections are preserved and unknown facts remain blank.
3. Push tested changes to GitHub's `main` branch. Vercel deploys automatically.
4. Confirm Vercel reports **Ready**, check the live results, and record the change and test outcomes in the [production test results](PRODUCTION-TEST-RESULTS.md).

Keep AI keys in Vercel's server settings.

## Current pricing status

The deployed calculator uses the 18 October pricing snapshot, including a 10% audit calculation. The newer fixed-project and monthly-program options, agreed fixed audit fee, single eligible audit credit, and route-specific ROI still require implementation and testing against the business references. Existing production test results cover the earlier rules.

For developer setup and further technical details, see the [README](../README.md).
