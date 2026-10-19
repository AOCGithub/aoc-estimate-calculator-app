# Vercel staging deployment

This repository is configured for a Git-connected Vercel preview. The Vite client is built into `dist/client`, and the existing calculation, organizer, and retained intake contracts are exposed through Vercel Functions under `api/`.

The current release remains a testing preview. Do not present it as the qualified client production calculator until the access gate, commercial pricing approvals, and remaining launch checks in `DEVELOPER-HANDOFF.md` are complete.

## Import from GitHub

1. Sign in to Vercel with an account that can access `AOCGithub/aoc-estimate-calculator-app`.
2. Choose **Add New > Project**, then import that GitHub repository.
3. Keep the repository root as the project root.
4. Vercel should detect **Vite**. The committed `vercel.json` supplies:
   - Build command: `npm run build`
   - Output directory: `dist/client`
   - Node.js Functions for the existing `/api` routes
5. Deploy first as a preview and use synthetic test information only.

## Environment variables

The calculator works without OpenAI by using its conservative local organizer. For the initial preview, set:

```text
AOC_AI_ORGANIZER_ENABLED=false
AOC_INTAKE_MODEL=gpt-5.4
```

To test the optional OpenAI organizer later, add `OPENAI_API_KEY` as a Vercel secret and change `AOC_AI_ORGANIZER_ENABLED=true`. Configure these as server-side variables for the intended Preview or Production environment. Never use a `VITE_` prefix for the key; that would expose it to browser code. Redeploy after changing environment variables.

## Required smoke test

After Vercel provides the preview URL:

1. Load the estimator and confirm all 12 business areas appear.
2. Use the synthetic Finance fixture documented in `DEVELOPER-HANDOFF.md`.
3. Confirm the result badge says **SERVER VERIFIED** and returns build `$11,500`, audit `$1,150`, and Priority monthly service `$550`.
4. Change responsibility to self-managed and confirm monthly service becomes `$0` after recalculation.
5. Confirm changing an answer marks the estimate for recalculation.
6. Test the mobile layout and the estimate-summary download.
7. If OpenAI organization is enabled, use synthetic text and confirm provider failure still preserves the description and falls back safely.

## Platform notes

- Vercel Functions have a 4.5 MB request/response payload limit. The retained transcription adapter therefore rejects audio at 4 MB. Voice remains disabled in the current interface and requires its separate documented implementation phase.
- The Vercel adapter does not change pricing. It imports the same deterministic calculation, field bank, and validation contracts used by local development and the packaged Worker.
- `vercel.json` applies baseline content, referrer, permissions, and content-type response headers. WordPress embedding is a later phase and will require a deliberate `frame-ancestors` policy change.
- `.vercel/` is ignored and must not be committed.

## Automatic deployments

After the GitHub repository is connected, pushes to the configured production branch create deployments automatically. Use Vercel preview deployments for review and testing; promote to a production domain only after the launch blockers are resolved and approved.
