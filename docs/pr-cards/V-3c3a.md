# V-3c3a — Verified declined PaymentIntent TEST event

Status: IN PROGRESS. Design: docs/designs/BATCH-V.md §4/V-3.
Predecessor: V-3c2 #62 merged. Baseline: latest main after #62.
Risk: safe incoming TEST failure, authentic generated event evidence; no LIVE or money-out.
Budget: about 120 production lines; no migrations.

## Read only these
- docs/SESSION-START.md §0–6; AGENTS.md hard limits and PR gate.
- src/dev/triggers.js, src/dev/triggers-updates.js, src/dev/triggers-invoices.js.
- src/tools/dev-events.js and tests/unit/dev-events.test.js, mock equivalents.
- docs/implementation-contracts/DRIFT-PROTOCOL.md checklists A/B.

## Drift A
| Assumption | Existing code/provider behavior | Reconciliation |
| --- | --- | --- |
| Failed PaymentIntent create returns a reliable source ID | Declines can throw a StripeCardError and lose the creation response | Create a run-tagged unconfirmed payment first; verify and record exact ID before separate confirm |
| Stripe confirm returns a success object for a decline | Actual declined TEST card raises a card error | Catch only card_declined and independently retrieve failed attempt; reject all other errors |
| No event found means no event | Event delivery and pagination may lag | Keep running and replay exact run ID; confirm event by list AND independent retrieve |
| Failed means money moved | PaymentIntent must show zero amount_received | Fail closed unless requires_payment_method, matching failed-attempt error and zero received |
| Checkout, invoice failure and dispute can be tested using the same shortcut | Each needs independent provider prerequisites | Do not advertise them in this slice |

## Build contract
- Expose payment_intent.payment_failed only after real current-native TEST create + confirm with synthetic documented decline method.
- Source: 3600 USD cents, run-tagged synthetic TEST customer/payment, idempotent stable key, account-scoped durable ledger, no app-owned object touched.
- dev_trigger_event uses guarded preview+confirm, LIVE refusal and immutable plan, with no card data collection.
- Decline state independently read back. Both listed Event and events.retrieve must exactly match account, TEST, source ID, run tag, customer, 3600 USD and failed state.
- No credit, refund, transfer, payout, invoice, email, bank settlement or LIVE key.

## Tests
- Real-handler initial delay, retry, completed event, and failure provenance, result value, idempotency, unexpected Stripe error, confirmed-payment rejection.
- Pinned Stripe SDK/stripe-mock POST confirm and event list/get; update curated trigger listing.
- No SQL changes; run npm run check, npm test and mock suite. In connector-only session use draft PR and full exact-head check/unit/mock/db/ci.

## Done
Only real provider-generated payment_intent.payment_failed is advertised, verified and durably recorded; previous 13 scenarios unchanged; exact-head full CI green, self-review, and merge. Then V-3c3b genuine invoice failure/dispute, with Checkout only after real provider completion path exists.
