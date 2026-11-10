# Reference data

These versioned snapshots are controlled inputs for rule compilation and regression comparison. They are not served directly to browser users and should not be edited independently of the reviewed source workbook.

- `sheet-snapshot-20261018.json` — captured workbook data used by `scripts/build/compile-approved.cjs`.
- `commercial-rules-20261029.json` — active fixed-price launch rules, included training, source links, deferred monthly-build status and explicit nulls for unspecified prices. Individual internal role rates are not included.
- `commercial-rules-20261021.json` — historical monthly-build commercial model, superseded for launch by the 28 October decision. Retained for reconciliation and historical tests.
- `v8-rules-snapshot.json` — retained catalog and choice data used when packaging the Worker.
- `catalog-v6.json` and `department-regression.json` — historical reconciliation fixtures.
