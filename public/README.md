# Public runtime assets

Files in this directory are copied into the browser build by Vite.

- `approved-bank.js` and `approved-pricing.js` are generated, versioned rule data.
- `engine.js` and `journey-engine.js` are the framework-independent calculation runtime.
- `journey.css` supplies the calculator base styles, supplemented by `src/styles.css`. The redesigned entry page uses scoped `src/styles/access.css`.
- `fonts/` contains locally hosted interface fonts and their redistribution licenses.
- `licenses/react-bits.txt` retains the license for the Aurora component used on the entry page.
- `catalog.js`, `intake-contract.js`, and `journey-contract.js` also support Worker packaging and validation.
Do not add private workbook exports, credentials, or client records here.
