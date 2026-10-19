# Public runtime assets

Files in this directory are copied into the browser build by Vite.

- `approved-bank.js` and `approved-pricing.js` are generated, versioned rule data.
- `engine.js` and `journey-engine.js` are the framework-independent calculation runtime.
- `journey.css` is the active visual system.
- `catalog.js`, `intake-contract.js`, and `journey-contract.js` also support Worker packaging and validation.
Do not add private workbook exports, credentials, or client records here.
