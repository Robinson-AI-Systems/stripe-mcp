# D-5b — TEST invoice lifecycle with explicit provider state

Status: **MERGED (#45 as-if-merged; exact-head CI and self-review required before merge)**. Baseline `90a49c0059c8e8fe7e271824950dca10f25b7541` after D-5a #43 and CI-cadence #44.

## Exact scope
- Seven guarded TEST-only native operations: `invoice_delete_draft`, `invoice_finalize`, `invoice_send`, `invoice_charge_now`, `invoice_mark_paid_outside_stripe`, `invoice_void`, `invoice_mark_uncollectible`.
- Stripe invoice state and cents control preflight; refuse app-owned invoices, subscription invoices, unknown customer/payment method, automatic advance, partial-payment write-off/void and changed balance.
- Invoice charge has a provider-derived USD money-**in** spec (not an outgoing expenditure); every operation requires idempotency, confirm, audit and independent provider read-back. No LIVE or real financial activity.
- TEST send only creates `invoice.sent`; it does not email customers. Draft delete requires definitive provider `resource_missing`, not merely a successful HTTP DELETE.
- Seven actual-handler write-contract suites; negative/stale balance, ownership, uncertain deletion, and incoming charge assertions; pinned SDK stripe-mock endpoints for all seven routes.
- Registry, profile counts, catalog, STATUS, owner guide, plan and architecture reconciled. D-5c credit notes next. No old toolkit adapters.
- No owner decision needed for isolated TEST development. IN-02, IN-03, IN-04 remain deployment prerequisites; IN-06 LIVE stays OFF.

## Acceptance evidence
- `tests/unit/invoice-lifecycle-contract.test.js`: seven real-handler contracts and safety regressions.
- `tests/mock/invoice-lifecycle.test.js`: pinned Stripe SDK routes on stripe-mock.
- `npm run check`, complete unit/mock/db, and exact-head `ci` required; no local shell, so mark unverified until CI.
- Full self-review against `docs/AI-PR-READ-FIRST.md`, then merge only at verified green head.
