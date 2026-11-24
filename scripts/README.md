# Project commands

Run commands from the repository root. Existing npm command names are unchanged; `package.json` points them to the grouped files below.

| Folder | Responsibility |
| --- | --- |
| `build/` | Compile approved workbook/rule data, package the retained Worker and validate its artifact |
| `dev/` | Local entry/profile previews and isolated sample support-pricing preview |
| `database/` | Explicit schema setup/checks and operator-only invitation tooling |
| `deployment/` | Explicit Vercel profile-settings configuration |

Routine commands:

```sh
npm run dev:profiles
npm run dev:g2
npm run build:worker
npm test
```

The profile preview uses local SQLite by default. `npm run dev` and commands wrapped in `vercel env run -e production` use the linked project's server settings; they can call real providers or persist opted-in information. Database/deployment scripts are operator tools, not build steps. Do not run setup/configuration scripts as part of routine UI changes.

`npm run dev:g2` starts G2 on port 5173 with the existing Vercel server settings, AI prefill and optional Supabase saving. Saving details/estimates and remembering profiles still require their separate unchecked consents. Payment rehearsal records remain in local SQLite. The Git-ignored `.env.stripe.local` overrides inherited Stripe credentials and must contain a sandbox key. Run `npm run dev:g2:stripe` in a separate terminal for sandbox webhooks. Checkout uses the server-calculated 15% audit fee; no fixed Price ID is needed. See [G2 setup](../docs/features/G2-STRIPE-HANDOFF.md). Neither command deploys or enables real billing.

For approved workbook changes, run `node scripts/build/compile-approved.cjs`, review the generated files and run `npm test`. Keep sample pricing isolated to `npm run preview:test-pricing`; it does not replace missing AOC prices.

See [pricing/form maintenance](../docs/PRICING-AND-FORM-MAINTENANCE.md), [profile setup](../docs/features/OPTIONAL-CLIENT-PROFILES.md) and the [test guide](../tests/README.md).
