# G3 C10 confirmation and rehearsal record

Status: implemented for sandbox review; external destination and live authorization deferred
Reviewed: 27 November 2026

## Agreed implementation scope

The G3 branch includes all three requested C10 items:

1. Generate a client-specific C10 order from the immutable saved quote and intake snapshot.
2. Require affirmative acceptance of the exact C10 reference and version before Stripe Checkout opens.
3. After a server-verified successful payment, attach the accepted C10 as a PDF to the client and support messages.

The accepted C10 and the estimate are separate PDF attachments. The Stripe receipt remains a separate Stripe link. The C10 uses the current service name and saved fee; the older template does not replace current calculator pricing or service wording.

## Data recorded in C10

- C10 reference, version, content fingerprint, issue time and acceptance time
- authorized representative and saved company/contact details
- agreed business area, exact work description, systems and department context
- included discovery deliverables and exclusions
- locked fee, currency, sandbox tax treatment and total
- delivery, eligible build credit, refund and change-control wording
- submission, work-description, purchase, Stripe Checkout and payment references
- payment status

Internal template instructions are not included in the client PDF. The accepted order JSON is persisted on the purchase so later calculator or template changes cannot alter what was accepted.

## Safety and repeat-event behavior

- Checkout rejects a missing or changed C10 reference/version.
- Stripe metadata carries the C10 reference/version and is verified with the other purchase references.
- Failed, expired, incomplete and unpaid payments send no paid confirmation.
- Duplicate or concurrent events retain one intake and one delivery claim per audience.
- Sandbox messages remain clearly marked and never claim a real charge or booking.

## Decisions still required from Vianca/Diana

Before live use, confirm:

1. Final client and internal email wording and the authorized sender/client/support recipient rules.
2. Whether the current private `g2_sandbox` rehearsal intake is the required rehearsal record or whether an external project record must be created/linked.
3. The external destination, required fields and access method if a separate project record is required.
4. The approved tax/cancellation wording for a real client order; the current C10 truthfully records the sandbox checkout behavior only.
5. The designated sandbox inboxes for the final receipt test.

The internal `audit_intake_reference` is a private rehearsal intake identifier. It must not be described as an external project record unless Vianca/Diana choose and approve that destination.

## Exact remaining work

If the existing private rehearsal intake is accepted as the destination, the remaining work is database migration, deployment and one designated sandbox inbox rehearsal: approximately **1-2 active hours** after approvals and access are available.

If an external project system is required, its connection and field mapping are deferred. Estimate that work only after the destination and authentication method are supplied.
