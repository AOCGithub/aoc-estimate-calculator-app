# G2 payment emails

After Stripe confirms the audit payment, the app sends two separate emails. Support receives the client and payment details plus the estimate, purchase and audit intake references. The client receives a confirmation at the email Stripe collected during Checkout, with the saved estimate PDF attached and a link to the Stripe receipt. Both copies are marked as Stripe sandbox tests.

## Authorize Microsoft 365

The Microsoft 365 admin chooses an AOC sending mailbox and creates a single-tenant app registration for the calculator. Use [Exchange Online Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac) to grant `Application Mail.Send` scoped to that mailbox. Leave organization-wide Microsoft Graph mail permissions ungranted because those permissions would also apply to the app.

The Exchange admin can use these commands after connecting to Exchange Online. `$enterpriseAppObjectId` is the Object ID under **Enterprise applications**:

```powershell
$sender = '<approved AOC mailbox address>'
$appId = '<application client ID>'
$enterpriseAppObjectId = '<enterprise application object ID>'
$mailbox = Get-EXOMailbox -Identity $sender
$mailboxId = $mailbox.ExternalDirectoryObjectId
if (-not $mailboxId) { throw 'The approved sender mailbox could not be identified.' }
$scopeName = 'AOC Estimator Sender Mailbox'
New-ServicePrincipal -AppId $appId -ObjectId $enterpriseAppObjectId -DisplayName 'AOC Estimator Email'
New-ManagementScope -Name $scopeName -RecipientRestrictionFilter "ExternalDirectoryObjectId -eq '$mailboxId'"
New-ManagementRoleAssignment -Name 'AOC Estimator Send Only' -Role 'Application Mail.Send' -App $enterpriseAppObjectId -CustomResourceScope $scopeName
Test-ServicePrincipalAuthorization -Identity $enterpriseAppObjectId -Resource $sender
```

Check that `Application Mail.Send` reports `InScope` for the sender. Repeat the test for another AOC mailbox outside the scope and confirm it reports `False`.

## Configure and test on Vercel

| Variable | Value |
| --- | --- |
| `AOC_G2_EMAIL_PROVIDER` | `microsoft365` |
| `AOC_G2_EMAIL_FROM` | The approved mailbox's primary email address |
| `AOC_G2_MS_TENANT_ID` | Directory tenant ID |
| `AOC_G2_MS_CLIENT_ID` | App registration's application client ID |
| `AOC_G2_MS_MAILBOX_ID` | The approved mailbox's `ExternalDirectoryObjectId` |
| `AOC_G2_MS_CLIENT_SECRET` | The Entra client secret **value**, saved as a sensitive variable |

1. Apply the payment-email migration with `node scripts/database/g2-database.mjs setup` under the target environment. Run `node scripts/database/g2-database.mjs test` to verify the private tables and delivery records using synthetic data.
2. Set `AOC_G2_EMAIL_TEST_CLIENT_TO` to the mailbox designated to receive the sandbox client copy. The support copy always goes to `support@alwaysopencommerce.com`.
3. Set `AOC_G2_PAYMENT_EMAILS_ENABLED=true` and redeploy. Complete a sandbox purchase, check both inboxes, open the PDF and Stripe receipt, and confirm a repeated event produces one copy per inbox. Declined, expired and unpaid checkouts should create no emails.

## If delivery fails

The app saves the paid result before attempting email. Stripe can retry the webhook after a temporary delivery error. A `sent` row means the provider accepted the message for delivery. For a `failed`, `uncertain`, or stuck `sending` row, check the sender's Sent Items or Exchange message trace before resending. If Stripe has no usable checkout email, the support copy calls that out. The client copy waits for Stripe's receipt.

`npm run test:g2` exercises the signed webhook, message contents, attachment, Microsoft request format and retry behavior with synthetic data. Local previews can use SMTP capture with `AOC_G2_EMAIL_PROVIDER=smtp` and the `AOC_G2_SMTP_*` settings.
