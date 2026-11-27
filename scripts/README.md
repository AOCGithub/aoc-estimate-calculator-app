# Project commands

Status: operational
Reviewed: 25 November 2026

Run commands from the repository root.

| Folder | Responsibility |
| --- | --- |
| `build/` | Compile current rules, package the retained Worker and validate artifacts |
| `dev/` | Local entry/profile/payment previews and Stripe test listener |
| `database/` | Explicit additive schema checks/setup and operator tools |
| `deployment/` | Explicit Vercel configuration helpers |

Routine commands:

```sh
npm run dev:profiles
npm run dev:g2
npm run build:worker
npm test
```

`npm run dev:profiles` uses isolated local SQLite. `npm run dev` and `npm run dev:g2` inherit the linked Vercel production environment and can use paid providers or persist explicitly consented records. Use them deliberately.

`npm run dev:g2` is a Stripe sandbox rehearsal. `npm run dev:g2:stripe` runs the local webhook listener. Sandbox secrets belong only in ignored `.env.stripe.local`; live keys are rejected by the payment implementation.

For approved rule changes:

```sh
node scripts/build/compile-approved.cjs
npm run test:domain
npm run build
```

Database/deployment scripts can change external state and are not routine build steps. Verify the target environment and use synthetic records. Follow [documentation governance](../docs/DOCUMENTATION-GOVERNANCE.md) and [pricing/form maintenance](../docs/PRICING-AND-FORM-MAINTENANCE.md).
