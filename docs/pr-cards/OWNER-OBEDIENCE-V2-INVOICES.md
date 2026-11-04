# OWNER-OBEDIENCE-V2-INVOICES — LIVE invoices & credit notes confirmed-action conversion

Status: **SOURCE-IMPLEMENTED.** Family 4 of 13 of conformance
row 17, conversion **V2** (appendix mechanism 28). This is
corrective work inside the already-merged invoice choreography
(D-5a/D-5b/D-5c); it completes no predefined batch subsection
and must not be counted as one.
Baseline: `main` `552ca804f381dbf961659243ef603db0cf297f58`
(after PRs #303–#309); rebased onto `5e657d27` (PR #310,
Payments) before landing. Design draft:
`~/workspace/stripe-v2-design/card-invoices.md`; census:
`~/workspace/stripe-v2-design/census.md` Family 4.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The design card is named `card-invoices-credit-notes.md` | The file on disk is `card-invoices.md` | Read and built against the actual file; no content difference resulted |
| The mode-aware replacement of `client(ctx)` in `src/tools/billing-shared.js` is shared with Families 2 and 5 and lands in whichever builds first | It already landed in PR #304 (OWNER-OBEDIENCE-V2-SHARED): `client(ctx)` delegates to `modeClient` in `src/tools/account-mode.js` | No seam work in this card; all three handler groups already resolve their provider client mode-awarely |
| The family's proof suites are `tests/unit/invoices.test.js` and `tests/unit/invoice-lifecycle.test.js` | Those paths are the `tests/mock/` SDK request-shape suites (payload shapes do not change with mode); the family's handler-level unit suites are `tests/unit/invoice-write-contract.test.js`, `invoice-lifecycle-contract.test.js` and `creditnote-contract.test.js` | Mock suites untouched; the three contract suites pass with unchanged expectations, and conversion proof lives in the new `tests/unit/invoices-live-conversion.test.js` |
| `tests/unit/money-reservation.test.js` carries charge/credit expectations to update | It covers the generic reservation ledger and names no invoice tool. `invoice_charge_now` is money-**in** (direction `in`), which the reservation accepts unconditionally by design; its aim check is the exact-balance proof in the lifecycle `prepare`, unchanged | Suite run unchanged and passing; the LIVE charge proof asserts exactly one provider charge of the provider-verified balance |
| Dispatcher admission changes need capability-report regeneration | The capability-report scripts do not derive from `guardedTestAreas`/`guardedLiveAreas` (grep-verified across `scripts/`) | No report regeneration; the registry/profile suites are the admission instrument |
| After admission, the write-contract helper's bare-LIVE-flip case (case 6) would stop refusing | It still refuses: the refusal is now produced by the core LIVE guard (`authorizeLiveWrite`: non-production deployment / account not independently enabled and connected), exactly the Disputes precedent | Assertions unchanged — the refusal still fires, now for the correct reason; enabled-LIVE behavior is proven by the new LIVE fixtures |
| `creditPreflight` belongs to the write family alone | The `creditnote_preview` **read** tool calls it too (`src/tools/creditnotes.js`) | The shared helper takes an optional mode and asserts it when given; the read handler now passes its connection mode as well. No TEST behavior change (fixtures without `livemode` pass the assertion, as everywhere in this conversion) |
| The fourteen tools split evenly across the three write modules | `invoice_delete_draft` exists only in the lifecycle module; the split is 5 draft + 7 lifecycle + 2 credit-note tools | Registry test asserts the exact fourteen-name set |
| A preview → approve → confirm sequence can mix argument sets | `previewFingerprint` is part of the idempotency payload (not in `src/stripe/client.js`'s OMIT set), so the money approval binds to the exact argument set that presented it | Test-fixture fact, already the Money/Payments/Disputes LIVE treatment: the credit-note LIVE test uses one consistent argument set for request, approval and execution. No code change resulted |
| JIT cards are registered in `docs/pr-cards/work-index.json` | None of the merged V2 cards (SHARED, MONEY, DISPUTES, PAYMENTS) is registered there; the index validator passes without them | This card follows that precedent; no index change |

## Build contract, as built

- `src/core/profiles.js`: **`invoices` is added to
  `guardedTestAreas` and to `guardedLiveAreas`** — the
  dispatcher admission this family uniquely needed, in both
  modes, for exactly the fourteen tools (5 draft writes in
  `invoice-writes.js`, 7 lifecycle writes in
  `invoice-lifecycle-writes.js`, 2 credit-note writes in
  `creditnote-writes.js`, all area `invoices`). No other area's
  admission changes: without the owner-approved LIVE connection
  the LIVE admission still refuses, a zero-ceiling non-owner
  connection still cannot reach the two money operations, and
  `read_only` still refuses everything. Rows 20–21 are
  untouched.
- `src/tools/invoice-writes.js` + `invoice-draft-shared.js`:
  the TEST-mode wrapper gate is gone. The family validator
  strips the core `previewFingerprint` control field (the
  schema declares it, per the V2 shared card's ruling 5 —
  uniform across modes). `verifiedCustomer`, `verifiedDraft`
  and `verifiedInvoiceItem` demand the connection's mode on
  every evaluated object; the summary is mode-labeled and the
  draft-total line names the connection's mode; `readAfter`
  asserts the mode on every retrieved invoice, line item and
  each remaining line item, and `verify` refuses a read-back
  whose present `livemode` disagrees with the connection.
  Descriptions de-TESTed.
- `src/tools/invoice-lifecycle-writes.js` +
  `invoice-lifecycle-shared.js`: both TEST-mode gates (the
  `make` wrapper and the `handlers` export) are gone.
  `lifecyclePreflight` asserts the connection's mode on the
  invoice, and on the customer and saved payment method in the
  send/charge branches; `verifiedLifecycleInvoice`'s manual-
  invoice error is mode-parameterized with every invariant
  (complete USD, automatic collection off, verified customer,
  draft/open state proofs) unchanged. Previews are mode-
  labeled: in LIVE, `invoice_send` discloses that Stripe
  emails the real customer at their verified address and
  opens real collection; `invoice_finalize` discloses the
  invoice becomes immutable (both modes); `invoice_void` and
  `invoice_mark_uncollectible` disclose the receivable is
  written off. The two exact tools keep their
  `expectedRemainingCents` equality proofs; `invoice_charge_now`'s
  money-spec description is mode-parameterized with the TEST
  wording byte-identical. **The money spec amounts and the
  `defineWrite` money wiring are untouched.**
- `src/tools/creditnote-writes.js` + `creditnote-shared.js`:
  both TEST-mode gates are gone. `creditPreflight` asserts the
  connection's mode on the parent invoice and on Stripe's
  preview credit note; the void preflight asserts it on the
  credit note and its parent invoice. The create summary is
  mode-labeled and keeps the exact-owner-approval and
  $500/account/Denver-day limit wording; the issued-credit
  verify is mode-gated. The provider-derived amount and
  allocation agreement proofs are unchanged, and
  `creditnote_create` still executes only through the guarded
  money contract: **no new money path is created, and
  `src/tools/write.js`, `src/money.js` and `src/db.js` are
  byte-untouched by this card (verifiable in the diff).**
- `src/tools/creditnotes.js` (read): the preview handler
  passes its connection mode into the shared preflight (see
  drift table). No other read behavior changes.
- Reused, not rebuilt: the `defineWrite` lifecycle (fresh
  read, app-ownership target guard, preview, `confirm`,
  `rmcp_` idempotency, `recordChange` journal, `verify`
  read-back), the shared preview-fingerprint binding in
  `src/core/write.js` (a drifted confirmation refuses with
  the fresh preview and fingerprint disclosed and executes
  nothing), `authorizeLiveWrite` as the LIVE-enablement
  guard, and `modeClient` for provider resolution.
- Aim checks preserved verbatim: the manual-invoice
  invariants (complete USD, automatic collection off,
  verified customer, draft/open state proofs); the
  app-ownership guard on target customer/invoice (proven in
  LIVE against an agreement-marked invoice); rows 20–21 for
  `creditnote_create`; the exact-balance proof for
  `invoice_charge_now` and `invoice_mark_paid_outside_stripe`
  (whose wording never implies a Stripe charge).

## Named tests

- `tests/unit/invoices-live-conversion.test.js` — **new, 19
  tests.** Dispatcher admission: the registry carries exactly
  the fourteen family tools; all fourteen admitted in TEST
  for `full`/`everyday` and refused for `read_only`; admitted
  in LIVE only on the owner-approved connection; without the
  owner context the two money operations need a positive
  money ceiling; the TEST and LIVE owner catalogs both list
  all fourteen (TEST reachability is new for this family).
  TEST end-to-end: `invoice_create_draft` completes preview →
  confirm; a drifted `invoice_update_draft` confirmation
  refuses with the fresh fingerprint and executes nothing,
  then completes with it. LIVE (owner connection, fake
  provider + fake database): preview → confirm happy paths
  for all fourteen operations, each executing exactly once;
  the finalize preview discloses immutability; the send
  preview discloses the real customer email and real
  collection; `invoice_charge_now` charges the
  provider-verified $20.00 balance exactly once;
  `creditnote_create` — confirm alone moves nothing and uses
  $0 of the day, an owner approval granted through the
  decision-intent path (the owner page's route;
  `approveMoneyRequest` remains the TEST-only direct route)
  executes exactly once and counts 8500 against the day;
  wrong-mode provider objects refuse at read in both
  directions (draft, lifecycle and credit-note reads), before
  any write; an agreement-marked (application-owned) invoice
  is refused by the target guard with zero writes.
- `tests/unit/invoice-write-contract.test.js`,
  `tests/unit/invoice-lifecycle-contract.test.js`,
  `tests/unit/creditnote-contract.test.js`,
  `tests/unit/profiles.test.js`,
  `tests/unit/money-reservation.test.js` — run with unchanged
  expectations, all passing (126 tests): every pre-existing
  refusal still fires, including the bare-LIVE-flip case now
  refused by the LIVE-enablement guard.
- Database suites: unchanged; database proof is exact-head
  CI's route on this machine (no local PostgreSQL binaries).
- Full unit suite and `npm run check` on the assembled tree.

## Done when

Met in source: all fourteen operations are admitted in both
modes and run the full confirmed-action sequence on synthetic
fixtures in tests — end to end in TEST (reachability itself
new) and in LIVE on the owner's own connection — with the
credit-note money gates demonstrably unrelaxed (confirm alone
moves nothing; the exact owner approval executes exactly
once and counts against the day) and every pre-existing
refusal still firing. Docs updated (this card, TOOL-CATALOG
`invoice_send` row, conformance row 17 V2 progress note,
COMPLETION, STATUS). No DECISIONS entry was needed — no new
decision arose; the conversion follows the coordinator
rulings and the merged families' idiom throughout. **Live
proof remains open** (CAP-5 queue): a real LIVE invoice or
credit-note action happens only when the owner elects to act
on a real invoice; this family's proof is source/synthetic
until then. No account was enabled, no LIVE key was used,
and no real money moved.
