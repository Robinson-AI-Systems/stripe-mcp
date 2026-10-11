# D-5c — Current-native TEST credit notes

Status: **MERGED (#46 as-if-merged; exact-head CI, full self-review and safe merge required)**.
Baseline main `db4b7b27d8275bf956eb0441416a061d9f101269` after D-5b #45. Parent card `docs/pr-cards/D-5.md`, approved `docs/designs/BATCH-D.md` §4 and `docs/AI-PR-READ-FIRST.md`.

## Bounded operations

- Three provider-backed TEST reads: `creditnote_list`, `creditnote_get`, `creditnote_preview`, with strict redacted USD summaries, bounded cursors and exact allocation.
- Two full `defineWrite-v1` TEST mutations: `creditnote_create` (independent authenticated one-use owner grant for **every** credit amount) and `creditnote_void` (no refund reversals).
- Per-account shared $500/Denver-day money-out cap; separate independently authenticated override above cap. Never authorize from `confirm` or other AI arguments.
- Credit note allocation limited to one exact choice: reduce unpaid invoice, refund a paid invoice, or create a verified customer credit balance. Request must match Stripe's official credit-note preview amount, invoice, customer, currency and refund/credit/out-of-band allocations, or fail closed.
- App-owned invoice/customer metadata default-denied, even when credit-note metadata is blank. Do not touch subscription invoices. No customer emails by default (`email_type:none`). TEST only. No old toolkit adapters.
- Every provider write has Stripe idempotency and independent retrieval; unknown/failed readback never declared successful. Voiding refunded/out-of-band credit notes refused.
- Pinned Stripe v23.0.0 + `2026-09-30.endive` SDK tests through stripe-mock for all new routes.
- After merge, complete Batch D reconciliation, then begin V-1 test seeding per current work index.

## Evidence before merge

- `tests/unit/creditnote-contract.test.js`: two actual-handler seven-case write-contracts, independent owner approval, app guard and fail-closed edge cases.
- `tests/mock/creditnotes.test.js`: official credit-note list/retrieve/preview/create/void request shapes.
- `npm run check`, full unit/database/mock, combined exact-head CI, review threads resolved, self-review against `AI-PR-READ-FIRST`; if no shell, CI is verification runner.
- D-5c delivery documented as-if-merged in STATUS, PLAN, MASTER-ROADMAP, architecture, catalog, owner guide and machine-readable work-index.
