# D-5a — TEST invoice inspection and guarded draft edits

Status: MERGED (#43; merge subject to final exact-head CI). Baseline main `30c1d4e7c6f69df038460e9d7f8344660c38a09c`; predecessor D-4 #42 merged.
Read: `docs/pr-cards/D-5.md`, `docs/designs/BATCH-D.md` §4 D-5,
TOOL-CATALOG invoices, `src/tools/billing-shared.js`, `src/tools/write.js`.

- Native provider-backed reads: invoice list/get/search/payments/preview.
- Draft mutations: create and update draft invoices, add/update/remove invoice items;
  fixed USD, explicit collection method, `auto_advance:false`, no surprise
  pending items. No destructive invoice lifecycle in D-5a.
- Guard all writes with real defineWrite, seven real-handler test cases per write,
  idempotency and provider readback. App-owned invoices/customer require explicit
  outsideApp; no LIVE credentials or real financial movement.
- Verify all official routes and payload shapes against pinned stripe-mock;
  update registry/profile counts, docs/index, full CI and self-review.
- Target 450–650 production lines, avoid filler; if exceeded split card.
- D-5b invoice lifecycle follows, then D-5c credit notes.

## Acceptance evidence

- Five invoice reads and five draft writes registered; no old API aliases.
- All five direct actual write-handler seven-case suites and draft accounting fail-closed regressions: `tests/unit/invoice-write-contract.test.js`.
- Pinned SDK request-shape tests: `tests/mock/invoices.test.js`.
- Manual invoice creation excludes unrelated pending items and keeps auto-advance disabled.
- All invoice line writes allow only positive USD draft items; unverified taxes, credits and discounts require Stripe Dashboard instead of guessed amounts.
- Self-review and exact-head combined CI are mandatory; no LIVE access or authenticated owner money approvals are performed by these draft tools.
