# Pricing and Form Maintenance

Updated: 22 October 2026

Use [Steve's implementation notes](https://docs.google.com/document/d/1ZR-7dAayjtmejgo6GQrtJeI3FSj3kGjNeq_7zIuEPMA/edit) and the [pricing workbook](https://docs.google.com/spreadsheets/d/1vUDbKYWQPTaVIvJEYGzY5pVDCt0n369Ywel0tPk9M7s/edit) as the business references.

The deployed calculator currently uses the 18 October pricing snapshot, including a 10% audit calculation. The newer monthly programs and revised audit treatment still require implementation and testing. Existing production test results cover the earlier rules.

## Updating the form

Update the [form components](../src/components/sections/) or the question bank's [reviewed sheet copy](../data/sheet-snapshot-20261018.json), depending on the question. Preserve existing field identifiers and check visibility, editable answers, required-field indicators, and AI prefill.

## Updating prices

Transfer approved workbook changes into the reviewed copy and affected calculation rules. Regenerate the pricing and question-bank files with `node scripts/compile-approved.cjs`, update the version and expected test results, and compare outputs with the workbook. Sheet edits do not update the website automatically. Flag missing amounts for Steve.

The newer requirements include fixed-project and monthly-program options, an agreed fixed audit fee, a single eligible audit credit, and route-specific ROI. Test these against the current notes before reporting them as implemented.

## Testing and publishing

Run `npm test` and check the affected journey, including changed and cleared answers. Verify the applicable prices, audit credit, and ROI; preserve manual corrections and leave unknown facts blank.

Push tested changes to GitHub's `main` branch. Vercel deploys automatically. Confirm the deployment is **Ready**, check the live result, and record what changed and passed. Keep AI keys in Vercel's server settings.

## Review links

- [Working calculator](https://estimate.alwaysopencommerce.com)
- [Recorded production test results](PRODUCTION-TEST-RESULTS.md)
- [Developer setup and technical maintenance](../README.md)
