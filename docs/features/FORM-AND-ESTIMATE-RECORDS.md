# Form and estimate records

Status: operational
Reviewed: 25 November 2026

Database saving is optional and independent from profile remembering. The **Save my details and estimates with AOC** choice starts unchecked.

## Tables

- `public.access_requests`: one entry submission with the five business/contact fields.
- `public.estimates`: immutable server-calculated snapshots linked by `access_request_id`.
- `public.client_profiles`: separately consented same-browser profile details.
- `public.access_invitations`: retained support for the inactive manual-review flow.

Each successful saved calculation creates a new estimate row; editing and recalculating does not overwrite an earlier snapshot. Local fallback results are not saved. A requested write failure leaves the visible calculation available but must say it was not saved.

The server chooses ownership from the signed HTTP-only session. Browser-supplied IDs or flags cannot authorize saving. There is no public history endpoint or email-based recovery.

## Inspect or delete

Find the parent in `access_requests`, then filter `estimates.access_request_id` by its UUID. To delete a submission, verify the exact UUID, delete its estimate children first and then the parent. Profile removal is a separate action.

## Configuration and checks

`AOC_ESTIMATE_RECORDS_ENABLED=true` enables estimate recording only in the compatible server mode and only with consent.

```sh
npm run estimates:db:check
npm run test:access
npm run test:intake-access:db
```

Database checks are opt-in and may create synthetic rows that they remove. Follow [Entry and saved-data maintenance](../GATE-AND-SAVED-DATA-MAINTENANCE.md).
