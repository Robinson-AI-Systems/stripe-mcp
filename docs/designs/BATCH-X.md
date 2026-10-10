# Design — Batch X: Undo, real-account smoke test, toolkit decision

Status: **APPROVED once IN-00 is answered.** Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch X.
Cards X-1 … X-3.

## 1. Decisions

**X1. Undo** (`stripe_undo_change(change_id)`): runs the stored `inverse` from the change log with preview and confirm.
Clean opposites: archive ↔ unarchive; deactivate ↔ activate; set `cancel_at_period_end` ↔ clear; pause ↔ resume;
metadata change ↔ restore; webhook event change ↔ restore old list. Money movement, sent/finalized invoices, submitted
dispute evidence and deletions have no inverse and say what the right opposite action is (e.g. a refund).

**X2. Smoke test** (`scripts/smoke-readonly.mjs`): every `writes: false` tool with minimal arguments on a **test-mode**
connection only (refuses live); report `docs/audits/smoke-<date>.md`.

**X3. Toolkit decision note:** one page for Chris — keep Robinson's Toolkit's `stripe` namespace for local development,
retire it, or point its compound tools at this server; the work each needs. Chris decides (IN-12); a later card does it.

## 4. Work units

### X-1 — Undo (M)
Tests: each clean opposite; money movement refuses with the suggested opposite; undo of an undo.
### X-2 — Read-only smoke test (M)
Done when: report committed; every failure fixed or listed as a known gap.
### X-3 — Toolkit decision note (S, docs)

## Amendments
