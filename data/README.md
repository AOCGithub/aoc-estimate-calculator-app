# Reference data

Status: operational inventory
Reviewed: 25 November 2026

Precedence follows [documentation governance](../docs/DOCUMENTATION-GOVERNANCE.md).

- `simplified-calculator-rules.json` — current editable rules; version `simplified-2026-11-25-v7-paid-advertising-coming-soon`.
- `sheet-snapshot-20261018.json` — retained workbook/question snapshot used by compilation and regression checks; not current commercial authority.
- `commercial-rules-20261029.json` — superseded fixed-project overlay retained for compatibility/history.
- `commercial-rules-20261021.json` — superseded monthly model retained for historical tests.
- `v8-rules-snapshot.json` — retained catalog/choice input used by Worker packaging.
- `catalog-v6.json` and `department-regression.json` — historical reconciliation fixtures.

Update the current simplified rules only from an approved latest source, regenerate public assets and update tests/docs together. Do not promote a snapshot or fixture into a current rule merely because older code references it.
