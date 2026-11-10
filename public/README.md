# Public runtime assets

Files in this directory are copied into the browser build by Vite.

- `approved-bank.js` and `approved-pricing.js` are generated, versioned rule data.
- `engine.js` and `journey-engine.js` are the framework-independent calculation runtime.
- Active React styles are in `src/styles/base.css`, `src/styles/calculator.css` and `src/styles/access.css`. `journey.css` is retained for historical interfaces and is not loaded by the current app.
- `fonts/` contains locally hosted interface fonts and their redistribution licenses.
- `licenses/react-bits.txt` retains the license for the Aurora component used on the entry page.
- `catalog.js`, `intake-contract.js`, and `journey-contract.js` also support Worker packaging and validation.
Do not add private workbook exports, credentials, or client records here.
