# Pre-deployment maintainability review — 30 October 2026

Scope: simplify existing implementation without removing features or publishing changes.

## Changes made

- Share the five-field entry template in `src/components/fields/AccessDetailsFields.jsx`. Normal entry and the paused review form retain their existing field IDs, labels, limits, autocomplete settings and submission behavior.
- Keep one Node implementation of access, calculation and organizer handlers in `server/api-handlers.mjs`. Vite now calls it through the thin `server/local-api.mjs` adapter instead of maintaining separate validation, cookies, calculation saving and provider calls in the build configuration.
- Keep deployable wrappers in `api/`, with shared implementation outside that directory. Standardize access wrappers on Vercel's Web Request/Response handler format, matching the calculator routes. No endpoint was removed.
- Stop decorative entry-page overflow from creating a horizontally scrollable container. This fixes sideways clipping when a form confirmation receives focus. Add a regression check.

The seven calculator sections and existing reusable field components remain separate. No new runtime dependencies, generic form framework, pricing rules, questions, database schema, verification requirement or profile/history feature were added. The preserved Worker and paused review flow remain available.

## Verified locally

- Full `npm test` passed before cleanup and after the final changes.
- New `npm run test:local-api` checks HTTP adaptation, injected local settings, invalid/oversized JSON, methods, origin/session guards, save failures, AI contract/fallback and Vercel context compatibility.
- Real Supabase/browser no-approval journeys passed at 1440px and 390px: form saving, immediate entry, linked calculation snapshots, changed/cleared answers, save-failure messaging, reload and logout.
- The preserved manual-review flow also passed on a separate localhost port at both widths, including pending requests, invitations, revocation, logout and calculation parity. It was not enabled on the normal preview or production.
- Existing database RLS/grant checks passed. Only each test's synthetic records were removed; existing submissions were preserved.
- Browser build checked for server-key/session-secret configuration references; none found. Pricing and generated rule files were not changed.
- `npm audit --omit=dev` reported zero known vulnerabilities in production dependencies.

AI checks used synthetic provider fixtures and fallback cases, not new paid provider calls. Browser coverage uses Chromium viewports, not physical iPhone/Android devices. No claim of universal or production certification is made.

## Before publishing

No commit, push, deployment or live environment change was made in this review. Before the future release, confirm the paired browser/server gate flags, intake-only mode, request/estimate recording, server-only database credentials and session secret in the intended Vercel environment. Recheck form-to-calculation saving and AI prefill on that actual deployment; a local pass does not establish its production configuration.

Reference for API entry format: [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js).
