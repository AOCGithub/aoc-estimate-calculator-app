# Optional client profiles

Status: operational
Reviewed: 25 November 2026

Profiles let a visitor explicitly remember business details and selected company facts for review and reuse in the same private browser. Profile consent is independent from saving form submissions/estimates and starts unchecked.

## Privacy and ownership

- The server issues a private HTTP-only owner cookie; email alone cannot retrieve a profile.
- Browser roles cannot read or write profile rows directly.
- Reuse requires review; newer manual edits and explicit clearing win over saved values.
- Updates use revision checks so concurrent writes cannot silently overwrite each other.
- Default expiry is 30 days after the latest save; reading alone does not renew consent.
- Forgetting a profile does not delete separately saved submissions or estimates.

## Configuration

- `AOC_CLIENT_PROFILES_ENABLED=true`
- `AOC_CLIENT_PROFILE_TTL_DAYS=30`
- `AOC_LOCAL_CLIENT_PROFILES_ENABLED=false` in production
- Private `CRON_SECRET` for protected expiry cleanup

Use the additive profile migration only when required; do not replace existing tables or secrets.

## Verification

```sh
npm run test:profiles
npm run test:profiles:database
npm run test:profiles:cloud-ui
```

The last two are opt-in real-database checks that create and remove synthetic rows. `npm run dev:profiles` uses isolated local SQLite; `npm run dev:profiles:database` intentionally uses the connected database.
