# Design — Batch X: Undo and read-only smoke test

Status: **APPROVED** (Chris, 2026-10-10, IN-00). Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch X.
Cards X-1 and X-2 only. X-3 was removed by the owner's no-legacy-compatibility decision (DECISIONS, 2026-10-10).

## 1. Decisions

**X1. Undo** (`stripe_undo_change(change_id)`): runs the stored `inverse` from the change log with preview and confirm.
Clean opposites: archive ↔ unarchive; deactivate ↔ activate; set `cancel_at_period_end` ↔ clear; pause ↔ resume;
metadata change ↔ restore; webhook event change ↔ restore old list. Money movement, sent/finalized invoices, submitted
dispute evidence and deletions have no inverse and say what the right opposite action is (e.g. a refund).

**X2. Smoke test** (`scripts/smoke-readonly.mjs`): every `writes: false` tool with minimal arguments on a **test-mode**
connection only (refuses live); report `docs/audits/smoke-<date>.md`.

## 4. Work units

### X-1 — Undo (M)
Tests: each clean opposite; money movement refuses with the suggested opposite; undo of an undo.
### X-2 — Read-only smoke test (M)
Done when: report committed; every failure fixed or listed as a known gap.

## Amendments
