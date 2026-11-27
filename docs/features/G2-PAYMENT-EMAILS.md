# Payment emails

Status: operational sandbox feature
Reviewed: 27 November 2026

After Stripe independently confirms a paid sandbox Checkout session, the app sends separate messages:

- Support receives the client/payment details and immutable estimate/purchase/rehearsal references.
- The sandbox client recipient receives the AOC next-step message, accepted C10 PDF, separate saved estimate PDF and separate Stripe receipt link when Stripe supplies a checkout email and receipt.

The Stripe receipt remains Stripe’s document; it is not the AOC email. Failed, expired, unpaid, mismatched and duplicate events cannot create a new paid confirmation.

## Configuration

Required common variables:

- `AOC_G2_PAYMENT_EMAILS_ENABLED=true`
- `AOC_G2_EMAIL_FROM=<approved sender>`
- `AOC_G2_EMAIL_PROVIDER=smtp` or `microsoft365`
- Optional sandbox redirect: `AOC_G2_EMAIL_TEST_CLIENT_TO=<approved test inbox>`

SMTP uses `AOC_G2_SMTP_HOST`, `AOC_G2_SMTP_PORT`, `AOC_G2_SMTP_USER` and secret `AOC_G2_SMTP_PASSWORD`.

Microsoft 365 uses `AOC_G2_MS_TENANT_ID`, `AOC_G2_MS_CLIENT_ID`, `AOC_G2_MS_MAILBOX_ID` and secret `AOC_G2_MS_CLIENT_SECRET`. Scope the application to the single approved mailbox using Exchange Online Application RBAC; do not grant organization-wide mail access.

Support is currently routed to `support@alwaysopencommerce.com`. The final G3 sender, recipients, wording and rehearsal-project destination still require Vianca/Diana authorization before any real-order workflow.

## Delivery safety

- The paid outcome is saved before email delivery.
- Each audience has its own persisted delivery state and idempotency claim.
- Temporary failure can be retried; ambiguous provider acceptance is marked for review rather than automatically duplicated.
- A `sent` state means the provider accepted the message, not guaranteed inbox placement.
- Check Sent Items/provider trace before manually retrying an uncertain message.

Run `npm run test:g2` for synthetic webhook, routing, C10/estimate attachment and retry coverage. Before claiming hosted email success, complete one authorized sandbox purchase and confirm both actual inboxes. Never use a sandbox message as proof of a real paid order.
