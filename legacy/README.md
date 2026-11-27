# Legacy pricing modules

Status: historical/compiler dependency
Reviewed: 25 November 2026

`model.js` and `department.js` remain because compilation and historical regression checks still reference them. They are not current commercial authority and cannot override `data/simplified-calculator-rules.json` or [Current system](../docs/CURRENT-SYSTEM.md).

Do not add new product behavior here. Migrate any still-required calculation into the current shared runtime with tests before removing a legacy dependency.
