# Vercel production test deployment

This repository is connected to Vercel. The Vite client is built into `dist/client`, and the calculation, organizer, and retained intake contracts are exposed through Vercel Functions under `api/`.

The current release is still a testing preview. Use synthetic information only. Do not present it as the qualified client calculator until the access gate, remaining commercial approvals, hosting-account review, and final launch checks are complete.

## Current deployment status - 28 October 2026

- AOC test hostname: `https://estimate.alwaysopencommerce.com/`
- Vercel fallback hostname: `https://aoc-estimate-calculator.vercel.app/`
- The AOC hostname resolves through the GoDaddy-managed `estimate` CNAME and loads successfully over HTTPS.
- The production organizer is enabled and returned a validated response using commercial configuration version `2026-10-21-commercial-v1` on 28 October 2026.
- The public test version does not have the later qualification gate. Do not enter private client records.
- Pushes to the configured production branch deploy automatically. Confirm Vercel reports **Ready** before starting live checks.

## Import from GitHub

1. Sign in to the AOC-owned Vercel team that has access to `AOCGithub/aoc-estimate-calculator-app`.
2. Import that GitHub repository and keep the repository root as the project root.
3. Vercel should detect **Vite**. The committed `vercel.json` supplies:
   - Build command: `npm run build`
   - Output directory: `dist/client`
   - Node.js Functions for the existing `/api` routes
4. Use synthetic test information until the client qualification and release controls are approved.

## Environment variables

The calculator has a conservative local organizer when the external provider is unavailable. Production AI organization requires these server-side settings:

```text
AOC_AI_ORGANIZER_ENABLED=true
AOC_INTAKE_MODEL=gpt-5.4
OPENAI_API_KEY=<approved server-side secret>
```

Never use a `VITE_` prefix for the API key. For local development, copy `.env.example` to the Git-ignored `.env.local`, add an approved key if provider testing is required, and restart Vite.

Provider failure must preserve the typed description and fall back without blocking the visitor. AI prefill must apply only supported facts, leave unknowns blank, and preserve manual corrections.

The Phase 2 five-field gate and server-side access foundation are implemented locally but disabled by default. Email ownership verification and AOC's approval workflow are not yet defined. Do not enable the gate for clients until those decisions are confirmed and implemented as described in [Phase 2 gated entry](PHASE-2-GATED-ENTRY.md). Do not enable only the browser flag or only the server flag.

## Required commercial smoke test

After a deployment reports **Ready**:

1. Load the AOC hostname and confirm all 12 business areas appear.
2. Test a synthetic fixed-price project. Confirm the audit is an entered fixed quote rather than a build percentage, one eligible credit is applied at most once, and the remaining project balance uses the 50/50 project schedule.
3. Test the three monthly build programs. Confirm the reviewed fees are `$4,000`, `$7,000`, and `$10,000` per month, included work is not added as a second upfront build charge, and the fixed-project 50/50 schedule is not used.
4. Leave monthly hours and the agency blend unanswered. Confirm the result keeps them pending instead of inventing an allowance or universal hourly rate.
5. Test self-management, unknown management, and managed support. Confirm self-management adds no optional post-project AOC fee, unknown remains unknown, and Standard/Priority/Premier support prices remain pending until approved.
6. Confirm changing or clearing an answer marks the result for recalculation and removes any result that is no longer supported.
7. Test the estimate-summary download and the complete desktop/mobile journey without page-level overflow.
8. Use a synthetic description to confirm known facts are prefilled, unknown facts remain blank, and manual corrections survive reorganization.

Quoted audit, project, agreement, hour, and blend values used in tests are synthetic fixtures. They are not approved customer prices or package entitlements.

## Platform notes

- Vercel Functions have a 4.5 MB request/response payload limit. The retained transcription adapter therefore rejects audio at 4 MB. Voice remains disabled in the current interface.
- The Vercel adapter does not define pricing. It imports the same reviewed calculation rules and validation contracts used by local development and the packaged Worker.
- `vercel.json` applies baseline content, referrer, permissions, and content-type response headers. WordPress embedding is a later phase and requires a deliberate `frame-ancestors` policy change.
- `.vercel/` is ignored and must not be committed.

## Automatic deployments

Pushes to the configured production branch create deployments automatically. After publishing, verify the exact deployed version, run the commercial smoke test above, and record the results in `PRODUCTION-TEST-RESULTS.md`.
