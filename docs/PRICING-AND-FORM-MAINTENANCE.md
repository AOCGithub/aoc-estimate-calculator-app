# Pricing and Form Maintenance

Updated: 22 October 2026

Steve approves pricing and business rules. Gino applies the changes, tests the calculator, and publishes the update.

## Updating the form

Send Gino the business area and question to change, the replacement wording or answer choices, and when the question should appear. A screenshot or example is helpful. For a new question, explain whether the answer should affect the price, identify a possible issue, or provide background information.

Gino updates the form and checks that the relevant questions appear, answers remain editable, and missing or invalid answers are handled correctly. If the change affects AI prefill, he also checks that the description fills the intended answers and preserves client corrections.

## Updating prices

Update the approved pricing sheet and identify the changed cells or rules for Gino. Include the old and new amounts, when they should take effect, and an example of the expected result where possible.

The website uses a reviewed copy of the pricing rules. Editing the sheet does not automatically update the live calculator. Gino transfers the approved changes into the calculator and compares its results with the sheet. Missing or unclear prices are referred to Steve; they remain marked for review until a price is supplied.

## Testing and publishing

Before publishing, Gino runs the automated checks and tests the affected journey. Pricing checks cover the affected build price, 10% audit fee and credit, optional monthly service, and ROI. Changing or clearing an answer must update the result correctly or show that information is missing.

After the checks pass, Gino pushes the update to GitHub. Vercel automatically builds and deploys it. He then confirms the deployment succeeded, checks the affected calculator journey on the live website, and records what changed and what was tested.

## Review links

- [Working calculator](https://estimate.alwaysopencommerce.com)
- [Recorded production test results](PRODUCTION-TEST-RESULTS.md)
- [Developer setup and technical maintenance](../README.md)
