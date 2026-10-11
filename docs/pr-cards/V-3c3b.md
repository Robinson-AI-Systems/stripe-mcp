# V-3c3b — Genuine TEST charge.dispute.created event

Status: MERGED (as-if-merged; exact-head CI required). Design: docs/designs/BATCH-V.md §4/V-3.
Predecessor: #63 merged (fb051c9). Baseline inspected: main after #63.
One risk: run-owned synthetic incoming TEST charge and async dispute identity; no migrations or LIVE.
Read only: src/dev/triggers.js, src/dev/run-store.js, src/dev/cleanup.js,
src/dev/scenarios.js dispute-trigger, tests/unit/dev-events.test.js, mock tests,
docs/implementation-contracts/DRIFT-PROTOCOL.md §A/B and AGENTS hard limits.

## Drift A
| Card assumption | Provider reality | Resolution |
| --- | --- | --- |
| A successful dispute test card guarantees dispute already created | Stripe charge can settle before asynchronous dispute | Retain running run, verify real charge.disputed plus exact disputes.list/retrieve |
| Dispute event contains source rtc_run metadata | Provider-created dispute and Event are not tagged automatically | Trace dispute -> recorded charge -> recorded tagged PI -> synthetic customer; exact event ID/source and account |
| Dispute object uses dp_ prefix | Official API uses du_ | Add new ledger type dispute:du and pin tests |
| A dispute charge is deletable | Financial/dispute evidence is immutable | V-2 cleanup always retains charge, dispute and their Event |
| A generated dispute proves event created | Provider events may lag | Bounded list AND independent retrieve required |

## Build
- Only add charge.dispute.created; use pm_card_createDispute on synthetic confirmed TEST PI for $36 incoming.
- Verify provider PI succeeded and full amount received, run metadata and synthetic customer; retrieve linked charge ID, independently validate status, amount, PI, customer and zero LIVE.
- On asynchronous dispute, filter Stripe disputes.list by exact charge, independently retrieve the candidate and validate amount/currency/charge/optional PI; record exact du_ ID. No generated refund, dispute response, charge reversal or money-out action.
- Independently match Event source dispute object with ledger-linked dispute ID and charge/PI, Stripe event type/account/TEST and amount, list then retrieve. Unknown/delayed remains running on retry; no invented webhook delivery.
- Add cleanup verified provenance and explicit immutable retention. Preserve prior plans and all owner limits.

## Validation
- Actual guarded MCP handler first call pending/retry completed, initial unknown event, never forge event, foreign object denial, no duplicate TEST charges, independent false-positive guards.
- Pinned SDK/stripe-mock: paymentIntents.create synthetic card, charges.retrieve, disputes.list/retrieve, events.list/retrieve.
- Full exact-head check, unit, mock, db and ci; self review then merge; successor V-3c3c native invoice.payment_failed and Checkout completions.
