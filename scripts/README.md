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
npm run build:worker
npm test
```

The profile preview uses local SQLite by default. `npm run dev` and commands wrapped in `vercel env run -e production` use the linked project's server settings; they can call real providers or persist opted-in information. Database/deployment scripts are operator tools, not build steps. Do not run setup/configuration scripts as part of routine UI changes.

For approved workbook changes, run `node scripts/build/compile-approved.cjs`, review the generated files and run `npm test`. Keep sample pricing isolated to `npm run preview:test-pricing`; it does not replace missing AOC prices.

See [pricing/form maintenance](../docs/PRICING-AND-FORM-MAINTENANCE.md), [profile setup](../docs/features/OPTIONAL-CLIENT-PROFILES.md) and the [test guide](../tests/README.md).
