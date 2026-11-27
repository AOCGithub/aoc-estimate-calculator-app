# Pricing and form maintenance

Status: operational
Reviewed: 25 November 2026

Use [documentation governance](DOCUMENTATION-GOVERNANCE.md) for every change. The latest approved source wins; old snapshots and tests are regression evidence only.

## Current baseline

- Authoritative summary: [Current system](CURRENT-SYSTEM.md)
- Editable rules: `data/simplified-calculator-rules.json`
- Implemented version: `simplified-2026-11-25-v7-paid-advertising-coming-soon`
- Latest workbook: <https://docs.google.com/spreadsheets/d/1vUDbKYWQPTaVIvJEYGzY5pVDCt0n369Ywel0tPk9M7s/edit>
- Latest change document: <https://docs.google.com/document/d/1ZR-7dAayjtmejgo6GQrtJeI3FSj3kGjNeq_7zIuEPMA/edit>

Older `commercial-rules-*`, workbook snapshots and legacy modules do not define current category availability or current simplified pricing.

## Apply an approved change

1. Record the exact new wording/value, owner approval, source version/date and affected subjects.
2. State what it supersedes. A narrow update must not silently replace unrelated current rules.
3. Update `data/simplified-calculator-rules.json` for pricing/category changes. Update the relevant React question or section for form-only changes.
4. Preserve stable field IDs unless a reviewed migration covers stored answers and tests.
5. Regenerate compiled rule assets:

   ```sh
   node scripts/build/compile-approved.cjs
   ```

6. Update `CURRENT-SYSTEM.md` and only the affected operational guide. Replace conflicting text instead of appending another dated account.
7. Update fixtures and tests to the same version.

Do not edit `public/approved-pricing.js` or `public/approved-bank.js` as independent sources. Do not invent missing fees. Proposed items must remain clearly proposed and excluded from approved totals unless the source explicitly approves them.

## Verify

At minimum:

```sh
npm run test:domain
npm run test:local-pricing
npm run test:vercel
npm run build
```

Run `npm run test:ui` for form/layout changes and `npm run test:g2` for payment/email changes. Run the full `npm test` before a broad release when the environment supports Chrome.

Check these behaviors manually:

- Only the six current areas calculate; Paid Advertising and the other five listed items remain Coming Soon.
- Selected process steps are valid for the chosen active area.
- Required inputs, cleared answers and manual corrections behave correctly.
- The server and browser report the same rules version.
- The paid discovery amount is exactly 15% of the complete one-time estimate.
- Unknown or proposed amounts are not presented as approved.
- All supported categories expose the same discovery/payment path when configured.

## Publish

Push the tested commit to `main`, wait for Vercel **Ready**, then check the public rules version and one representative active-category journey. Record the single release result in [Production test results](PRODUCTION-TEST-RESULTS.md).
