# Public runtime assets

Status: operational inventory
Reviewed: 25 November 2026

Vite copies this directory into the browser build.

- `approved-bank.js` and `approved-pricing.js` are generated/versioned rule data.
- `journey-engine.js`, `journey-calculation.js` and `journey-contract.js` provide framework-independent calculation and validation.
- Catalog/intake assets support the browser, Node handlers and retained Worker.
- `fonts/` contains local font files and licenses.
- `licenses/` retains third-party notices.

The editable current rule source is `data/simplified-calculator-rules.json`. Do not edit generated rule assets independently. Never place secrets, private workbook exports, client records or sandbox databases in `public/`.
