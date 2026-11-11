# Documentation

## Current maintenance and release guides

- [AOC maintenance guide](GATE-AND-SAVED-DATA-MAINTENANCE.md): entry, saving choices, finding records and checking updates.
- [Pricing and form maintenance](PRICING-AND-FORM-MAINTENANCE.md): applying, testing and publishing approved rules/questions.
- [Production test results](PRODUCTION-TEST-RESULTS.md): published verification and release evidence.
- [Vercel deployment](VERCEL-DEPLOYMENT.md): hosting, server settings and deployment checks.
- [System update notes](FORM-UX-UPDATES.md): implemented changes and their scope.

These guides keep their existing paths so shared handoff links continue to work.

## Feature references

- [Entry bot protection](features/RECAPTCHA.md)
- [Temporary entry without approval](features/TEMPORARY-INTAKE-ACCESS.md)
- [Form submissions and estimate records](features/FORM-AND-ESTIMATE-RECORDS.md)
- [Optional client profiles](features/OPTIONAL-CLIENT-PROFILES.md)
- [Live voice input and correction](features/LIVE-VOICE-INPUT.md)
- [Gated-entry scope](features/PHASE-2-GATED-ENTRY.md)
- [Access-request setup](features/ACCESS-REQUESTS-SETUP.md)
- [Manual-review trial](features/MANUAL-ACCESS-TRIAL.md)

The review-mode references describe retained functionality. Verification and AOC approval are currently paused; changing a request's review status does not control entry in intake-only mode.

## Historical reviews

- [11 November code/performance review](history/CODE-PERFORMANCE-REVIEW-2026-11-11.md) (local, not deployed)
- [Original developer handoff](history/DEVELOPER-HANDOFF.md)
- [Earlier maintainability review](history/MAINTAINABILITY-REVIEW.md)
- [4 November system audit](history/SYSTEM-AUDIT-2026-11-04.md)

Historical reports record the state at their date; use the current guides and active source rules for maintenance. See the [project README](../README.md) for the folder map and [test guide](../tests/README.md) for verification commands.
