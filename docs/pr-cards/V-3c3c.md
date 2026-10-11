# V-3c3c — Native TEST invoice.payment_failed (actual declined collection)

Status: MERGED (as-if-merged, exact-head CI/review required). Approved design: BATCH-V §4 V-3.
Predecessor: V-3c3b #64 merged, 478a4ae. Baseline: current main #64.
One risk: genuine TEST invoice failed payment evidence, no money-out or LIVE. No SQL migration.
Read: docs/SESSION-START.md §0–6, docs/designs/BATCH-V.md §4,
src/dev/triggers.js, src/dev/triggers-invoices.js, src/dev/triggers-failures.js,
src/dev/run-store.js, src/dev/cleanup.js, tests/unit/dev-events.test.js,
tests/mock/dev-invoice-events.test.js; DRIFT-PROTOCOL §A/B.

## Drift A
| Assumption | Current-native Stripe reality | Corrective contract |
| --- | --- | --- |
| A zero-value finalized invoice can fail payment | Zero-value invoices have no chargeable collection | Create run-owned 3600-cent invoice item before finalization |
| Stripe invoice.pay may return success even on failed card | Decline can throw provider card error | Catch only card_declined, then independent invoice read-back with actual failed attempted state |
| A draft or open invoice means failed | Open status alone is not evidence of attempted collection | Require amount due/remaining 3600, amount paid=0, attempted=true, attempt_count>0 after deliberate decline |
| Event success can be inferred from invoice state | Stripe events can lag or expire | Exact invoice.payment_failed Event list AND independent retrieve; absence leaves run running |
| New invoice item automatically cleans up with invoice | Finalized chargeable invoice financial evidence cannot always be removed | Track invoice item exact ii_ ID with rtc_run; V-2 retains immutable invoice items |

## Build contract
- Add only invoice.payment_failed, TEST only, guarded, deterministic requestKey.
- Own synthetic customer, draft charge_automatically non-auto-advancing invoice and one 3600-cent USD invoice item with metadata, each independently read and recorded before finalization or charge attempt.
- Stripe finalizeInvoice(auto_advance:false) and separate invoices.pay(payment_method:pm_card_chargeCustomerFail) with stable keys; never email, finalize automatically, capture payment, refund, transfer, payout or use a live account.
- Verify provider invoice has exactly 3600 due/remaining, zero paid, status open, attempted true and count positive, matching customer/run metadata. Only independently matching invoice Event snapshot completes.
- Replays never make second attempt once already verified. Provider failures leave running, not success.

## Test and acceptance
- Guarded full handler no Event/pending, observed Event after retry, no duplicate Stripe invoice/mutation, foreign metadata refusal, source mismatch no complete.
- Independent state tests for before/after attempt, bad amounts/status, retry and error; pinned SDK/stripe-mock creates invoice item/finalize/pay/Event APIs.
- npm run check, unit, mock, db and combined ci exact-head green before merge. Next V-3c3d Checkout completion lifecycle, then V-4.
