# V-5a — Provider-published TEST fixture lookup
Status: MERGED (#72 as-if-merged; CI/review gate pending).
Baseline: main 70abfca4. Risk: public reference consistency, no provider effect.
Read docs/designs/BATCH-V.md §4 V-5 and https://docs.stripe.com/testing
(Stripe-published PaymentMethod tables) and src/tools/testclocks.js.

## Exact scope
- One read-only tool dev_test_cards with documented TEST-only PaymentMethod IDs,
  not card PAN or bank account numbers. Cover success, issuer decline, attached
  failure, 3DS-required/declined, ACH success/failure/dispute/processing.
- No SDK call, network request, real payment or live-mode availability.
- Exact scenario, method and category filters, bounded pagination, source URL.
- Register in src/tools/index.js, update registry, profile and meta counts.
- Tests: doc fixtures, no raw PAN/secret, stable paging, live refusal, read_only
  wrapped call. No DB migration or external credentials.
- V-4 acceptance report in same PR reconciles former V-4 IN_PROGRESS card;
  V-5b is next.
