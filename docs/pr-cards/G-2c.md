# G-2c — Stage TEST dispute evidence, never submit
Status: as-if-merged (#93); exact-head CI/self-review pending.
Baseline inspected: 38ba88fd (#92). Approved Batch G / G-2.
No migration. Risk: unintentional evidence submission or app-owned billing mutation.

## Drift check A
| Design assumption | Actual pinned Stripe shape/current code | Correction and proof |
| --- | --- | --- |
| Dispute update only saves a draft by default | Stripe disputes.update defaults submit:true | ALWAYS pass explicit submit:false; mock assertion |
| Dispute evidence can reference arbitrary file ID | File can be from other purpose | Verify each file's exact ID and dispute_evidence purpose in selected TEST account |
| Save is safe after a deadline/submission | Provider rejects or already final | Require needs_response/warning_needs_response, future due_by, past_due false, submission_count 0 |
| Dispute customer ownership is explicit | Dispute exposes charge, which may be app-owned | Retrieve charge and preserve its metadata/customer for app guard; outsideApp explicit override |
| Provider success implies evidence persisted | Stripe update may be inconsistent/uncertain | Re-retrieve dispute; verify each staged text/file, same TEST ID and submission_count 0 |
| Sending full evidence into logs is okay | Dispute evidence can contain private customer data | Preview only keys, text lengths, file IDs and deadline; audit excludes evidence values |

## Build / acceptance
- `dispute_save_evidence`: standard guarded write, preview/confirm,
  TEST-only, app ownership and profile protection, deterministic idempotency
  and audit. Refuses stale/expired/submitted disputes.
- Supported draft fields: product_description, shipping_tracking_number,
  uncategorized_text; verified evidence file IDs for receipt, customer
  communication, shipping/service documentation, uncategorized file.
- Payload uses `{ evidence: selected, submit: false }` at every execution;
  cannot submit to bank or accept dispute. Read-back verifies all exact staged
  values; the result says `evidenceSubmitted:false` and lists only field names.
- CI: unit tests for preview, no-submit, idempotency, app-owned, invalid files,
  late disputes, LIVE/read_only gates and provider verification; Stripe-mock
  pinned disputes.update request and retrieve; profile/registry counts;
  five exact-head CI gates and reviewer threads clean.
- No real Stripe account connected; CI provider simulation only.

Next G-2d: irreversible `dispute_submit_evidence` and `dispute_accept`
as distinct fully guarded operations. Treat dispute_accept as **money-out**:
provider-derived exact loss amount, independent authenticated owner grant,
shared $500/Denver day cap and second independent override above limit.
No LIVE activity without owner authorization.
Source: https://docs.stripe.com/api/disputes/update
