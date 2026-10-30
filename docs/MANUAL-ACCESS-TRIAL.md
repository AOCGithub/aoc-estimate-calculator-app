# Local trial: request → review → private access link

Requested on 29 October 2026. Local only: no push, deployment, live access change, email provider or automatic email delivery.

This review flow is preserved but currently paused. The default local command now uses [temporary save-and-continue entry](TEMPORARY-INTAKE-ACCESS.md).

## Try the flow

1. Start `npm run dev:access:review` and open http://localhost:5173.
2. Submit the five business fields. The request is saved as `pending`; even an email on the old test allowlist cannot open the calculator.
3. In **Supabase → Table Editor → public → access_requests**, review the entry and change `review_status` to `approved` or `declined`.
4. For an approved request, copy its `id` and run:

   ```powershell
   npm run access:invite -- REQUEST_ID --local
   ```

5. Open the generated, Git-ignored `.txt` file in `artifacts/`. Copy its private localhost link into a new browser/private window and click **Open calculator**. Do not share a localhost link with external clients.

AOC sends production invitations manually using its normal communication channel only after the live flow is explicitly enabled. No message is sent by the app. The command refuses live link creation while manual access is not enabled in the deployment settings.

## What the trial changes

- One clear **Request access** action and a pending-review confirmation.
- Supabase review decisions replace the old email list in this mode. Changing status alone is not a login; a valid private link is also required.
- Links expire after 24 hours and work once. Generating a replacement invalidates earlier unused links for that request.
- The browser removes the token from its address bar before use. Only hashes of invitation/session secrets are stored in Supabase.
- A successful link starts an HTTP-only, same-site session (default 8 hours). Returning in that session does not require the form again. Expired sessions or a different device need a new link from AOC.
- Every protected API request checks the session expiry and current `approved` decision. Marking a request `revoked` or `declined` blocks its access; logout invalidates that session in the database.
- Changing a revoked request back to `approved` may restore its still-unexpired sessions. For permanent invalidation, expire its existing sessions in `access_invitations` before reapproving.
- Form details remain access-review records, not reusable calculator profiles. No marketing, calculator-answer storage, or email ownership verification was added. A forwarded unused link can be used by its recipient, so AOC must share it privately.

## Revert

Stop the local server, then run:

```powershell
npm run dev:access:previous
```

This sets `AOC_MANUAL_ACCESS_ENABLED=false` only for the local process and restores the previous provisional allowlist flow. Existing requests are not deleted. The additive invitation table can remain unused. Do not restore the whole repository or delete request data to undo this trial.

An additional copy of the pre-trial local changes is in the Git-ignored folder `artifacts/manual-access-before-20261029-f831f361/`. No secrets were included in that source backup.

## Checks

- `npm run access:manual:check` — database grants, RLS and invoker-only redemption.
- `npm test` — default-off behavior, previous flow and new server/Worker access tests, plus calculator regressions.
- `npm run test:manual-access:db` — real Supabase + local desktop/mobile browser journey; removes only its own synthetic records.

Database setup used the additive `20261029033128_manual_access_invitations.sql` migration. It preserved existing requests and added private invitation storage, extended review statuses and one atomic redemption function. Only trusted AOC database access can approve requests or create links; there is no public approval/issuance endpoint. SQL was applied directly by the setup script, not registered in Supabase CLI migration history.

The attempt limit is process-local, suitable for this internal trial—not a complete distributed anti-abuse system. Live client release remains a separate decision.

## Verification — 29 October 2026

Passed the real Supabase/browser journey at 1440px and 390px, including save failure recovery, approval-only issuance, expired and reused links, simultaneous redemption (exactly one success), session expiry, revocation, logout, unchanged calculator output, same-tab replacement invitations, and mobile alignment. Synthetic requests and their test links were removed; the earlier user-visible demonstration record was preserved.

The previous-mode command was also started on a temporary local port and checked in a browser. It restored the original five-field gate without touching database records. That temporary preview was stopped. These results describe the manual trial before it was paused in favor of temporary save-and-continue entry. No code was committed, pushed or deployed.
