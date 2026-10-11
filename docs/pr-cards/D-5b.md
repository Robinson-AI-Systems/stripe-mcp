# D-5b — TEST invoice lifecycle with explicit provider state
Status: **READY AFTER D-5a #43**. Baseline latest main after #43.
Parent: docs/pr-cards/D-5.md and approved docs/designs/BATCH-D.md.

Build the remaining invoices lifecycle operations: invoice_delete_draft,
invoice_finalize, invoice_send, invoice_charge_now,
invoice_mark_paid_outside_stripe, invoice_void and invoice_mark_uncollectible.
All guarded TEST only. Explicit invoice state transition preflight, source-of-truth
Stripe amounts and customers, provider read-back, real seven-case per write,
pinned stripe-mock route+payload coverage, app-owner isolation, existing owner
money policy (one-use independently authenticated approval for any outgoing
funds, separate >$500/day override). Never return client_secret or enable LIVE.

Verify draft deletion via independent Stripe retrieval or authoritative list
state; a successful deletion response alone is insufficient. Finalization and
payment cannot silently run automatic collection (check collection_method,
auto_advance, finalization/payment intent and due date). The paid-out-of-band
operation must use paid_out_of_band:true and must refuse app-owned invoices
by default, naming the owning app's Record Payment workflow.

~450–650 substantive production lines per PR (max ~800). Run full CI + docs B
and self-review, merge before D-5c credit notes. No old toolkit adapters.
