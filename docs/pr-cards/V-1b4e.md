# V-1b4e — guarded synthetic TEST ACH confirmation and actual provider event verification

Status: **MERGED (#55 as-if-merged; exact-head five CI checks and review required)**.
Parent V-1, approved Batch V §1/4. Baseline main 45fb44356c85466e3d8608e1788ccc9079bcc37d after #54.

## Drift check A

| Assumption | Actual code / pinned Stripe API | Corrective contract |
| --- | --- | --- |
| V-1b3 ACH payment is settled after initial seed | Seed only creates requires_confirmation/requires_action setup with 0 amount_received | New guarded TEST paymentIntents.confirm for precisely recorded run |
| Successful confirmation proves bank settlement | Processing is asynchronous; succeeded and succeeded event are later provider facts | Read-back processing/requires_action/succeeded and exact success event matching; bankSettlementVerified remains false |
| Simulated bank mandate is a real consumer grant | Fixture is a wholly synthetic Stripe TEST payment method with no real consumer | Label synthetic mandate explicitly, use only TEST-only method; no LIVE key/real bank debit |
| Confirmation can use arbitrary PaymentIntent ID | DB records customer/payment IDs bound to one account/run | Completed ach-awaiting-confirmation run only, original step/customer/payment/amount/metatdata verified before any provider write |

## Implementation

- TEST-only dev_confirm_seed_ach(runId,paymentStep). Run and ledger account-scoped, completed scenario and 1–5 step checked, exact USD cents, customer, rtc_run metadata and provider payment method type. Reject already-processed and unowned/provider-mismatched payments.
- Existing audited defineWrite preview and explicit confirmation. Synthetic TEST online mandate, idempotent native paymentIntents.confirm request, then independent re-read. Only a confirmed provider state of processing, requires_action or fully succeeded is accepted; do not claim actual settlement.
- dev_verify_outcomes ACH branch additionally scans bounded Stripe TEST payment_intent.succeeded event pages. Only exact provider event (PI ID, selected account, run tag, customer, currency, full cents) yields paymentSucceededEventObserved=true. Missing event never proves none occurred.
- No money-out operations; underlying separate owner approval and $500 per account Denver-day limit remain unmodified. No LIVE, unauthorized app-owned payments, PII, bank credentials, migrations or spending.
- Tests include real guarded handler preview/confirmation/identity/failures, test-only refusal, read-back mismatch, and pinned Stripe SDK stripe-mock confirmation and matching event cases. All required CI green on exact head before merge.

## Remaining V-1

Bank payment succeeded and real Stripe event can be observed; no assertion that real bank settlement occurred. Marketplace TEST scenario must be capability-verified before creation, with separate money-out approval for any transfer/payout. V-1 remains IN_PROGRESS until gated marketplace and end-to-end acceptance are complete; then V-2.
