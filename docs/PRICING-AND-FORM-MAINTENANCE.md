# Pricing and Form Maintenance

Updated: 22 October 2026

The calculator's forms and pricing are maintained in the AOC GitHub repository. Vercel publishes the tested app and its server API to [estimate.alwaysopencommerce.com](https://estimate.alwaysopencommerce.com). The steps below describe the current setup.

## Updating the form

The seven form screens are maintained in the [form components](../src/components/sections/). Shared required-field indicators are maintained in [form fields](../src/components/fields/FormFields.jsx). The detailed questions, answer choices, and business-area prompts come from the [reviewed sheet copy](../data/sheet-snapshot-20261018.json), which is used to generate the app's question bank.

To change a question, update its source and any affected screen or visibility rule. Keep its existing field identifier so entered answers, AI prefill, and calculations continue to match. Check that the question appears in the right scenario, remains editable, and flags missing answers correctly.

## Updating prices

The approved pricing sheet is the business reference. The website uses a versioned copy of those rules; sheet edits do not update the website automatically. AI fills answers, while the server calculates prices using the existing rules.

For an approved price change, update the reviewed sheet copy and affected rule mappings, then regenerate the app's pricing and question-bank files with `node scripts/compile-approved.cjs`. Compare the changed result with the sheet before publishing. Record the pricing version and update the expected test amounts where appropriate. Missing prices remain flagged for Steve rather than being guessed.

## Testing and publishing

Run `npm test` and check the affected form journey. For pricing changes, check the build, 10% audit fee and credit, optional monthly service, and ROI as applicable. Changing or clearing answers must mark the result for recalculation; recalculating must give the correct updated price or identify missing information. For prefill changes, also check that client corrections are preserved and unknown facts stay blank.

After testing, commit and push the reviewed changes to GitHub's `main` branch. Vercel automatically builds and deploys the update. Confirm the deployment is **Ready**, test the affected journey on the live website, and record the change and test result. AI keys remain in Vercel's server settings.

## Review links

- [Working calculator](https://estimate.alwaysopencommerce.com)
- [Recorded production test results](PRODUCTION-TEST-RESULTS.md)
- [Developer setup and technical maintenance](../README.md)
