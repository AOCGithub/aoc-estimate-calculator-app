# G2 payment emails

After Stripe confirms the audit payment, the app sends two separate emails. Support receives the client and payment details plus the estimate, purchase and audit intake references. The client receives a confirmation at the email Stripe collected during Checkout, with the saved estimate PDF attached and a link to the Stripe receipt. Both copies are marked as Stripe sandbox tests.

## Enable for a sandbox test

1. Use an AOC sender authorized by your SMTP provider. Set `AOC_G2_EMAIL_FROM`, `AOC_G2_SMTP_HOST`, `AOC_G2_SMTP_PORT`, `AOC_G2_SMTP_USER`, and `AOC_G2_SMTP_PASSWORD` as server-only variables. Store the SMTP password as a sensitive secret. Port `587` uses STARTTLS and `465` uses TLS on connection.
2. Apply the payment-email migration with `node scripts/database/g2-database.mjs setup` under the target environment. `node scripts/database/g2-database.mjs test` checks the private schema and delivery records using synthetic data.
3. Set `AOC_G2_PAYMENT_EMAILS_ENABLED=true` in the target environment. During rehearsal, set `AOC_G2_EMAIL_TEST_CLIENT_TO` to an AOC tester's inbox to redirect the client copy. The support copy always goes to `support@alwaysopencommerce.com`.
4. Complete a Stripe sandbox purchase. Check both inboxes, open the PDF and receipt, and replay the event to confirm each inbox received one copy. A declined, expired, or unpaid checkout should send neither email.

## If delivery fails

The app saves the paid result before attempting email. Stripe can retry the webhook after a temporary delivery error, and each recipient's delivery is tracked separately. A `sent` row means the SMTP server accepted it. For a `failed`, `uncertain`, or stuck `sending` row, look up the purchase reference in the SMTP provider's logs before resending. If Stripe has no usable checkout email, the support copy calls that out. The client copy waits for Stripe's receipt.

`npm run test:g2` exercises the signed webhook, message contents, attachment and retry behavior with synthetic data and an in-memory mail transport.
