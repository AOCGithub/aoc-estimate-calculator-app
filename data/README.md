# Reference data

These versioned snapshots are controlled inputs for rule compilation and regression comparison. They are not served directly to browser users and should not be edited independently of the reviewed source workbook.

- `sheet-snapshot-20261018.json` — captured workbook data used by `scripts/compile-approved.cjs`.
- `commercial-rules-20261021.json` — current approved program fees and commercial terms, with source links and explicit nulls for unapproved amounts. It supersedes earlier active commercial rules without discarding historical build coefficients. Individual internal role rates are not part of this client-visible configuration.
- `v8-rules-snapshot.json` — retained catalog and choice data used when packaging the Worker.
- `catalog-v6.json` and `department-regression.json` — historical reconciliation fixtures.
