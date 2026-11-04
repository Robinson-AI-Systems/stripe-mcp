# OWNER-OBEDIENCE-V2-BILLING — LIVE subscriptions, items and schedules confirmed-action conversion

Status: **SOURCE-IMPLEMENTED.** Family 5 of 13 of conformance
row 17, conversion **V2** (appendix mechanism 28). This is
corrective work inside the already-merged billing choreography
(D-4/D-4b); it completes no predefined batch subsection and
must not be counted as one.
Baseline: `main` `5e657d2707a6e52d0471a8c40a2d32c0efdd2df5`
(PR #310, Payments); rebased onto `c747c63d` (PR #311,
Invoices & credit notes) before landing. Design draft:
`~/workspace/stripe-v2-design/card-billing.md`; census:
`~/workspace/stripe-v2-design/census.md` Family 5.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| `client(ctx)` in `src/tools/billing-shared.js` throws for non-TEST and converts in this card | It already delegates to `modeClient` in `src/tools/account-mode.js` since PR #304 (OWNER-OBEDIENCE-V2-SHARED) | No seam work in this card; the family's two write modules and the read module already resolve their provider client mode-awarely |
| The family's proof suites are `tests/unit/billing.test.js` and `tests/mock/billing-write-contract.test.js` / `tests/mock/billing-item-schedule-write-contract.test.js` | The handler-level contract suites are `tests/unit/billing-write-contract.test.js` and `tests/unit/billing-item-schedule-write-contract.test.js`; `tests/mock/billing.test.js` is SDK request-shape only (payload shapes do not change with mode) | Mock suite untouched; both contract suites pass with unchanged expectations, and conversion proof lives in the new `tests/unit/billing-live-conversion.test.js` |
| `discountSafe` should demand mode equality with the connection | `discountSafe`/`discountList`/`itemSafe`/`subscriptionSafe` are also consumed by callers that have no connection mode in hand (read projections and workflow snapshots whose TEST fixtures carry explicit `livemode:false`) | The four projections take the connection's mode as a parameter: with a mode named, a discount verifies only when the discount and its coupon are exactly that mode — a wrong-mode or mode-less discount yields the `verified:false` sentinel, never a zero. With no mode named, the historical check applies exactly, so every existing caller keeps byte-identical behavior. The billing read handlers and both write families' evaluations pass the connection's mode |
| The shared field validator can admit `previewFingerprint` globally | `validateFields` in `billing-shared.js` is imported by roughly twenty modules across unconverted families | Left unchanged. Both billing write modules strip `previewFingerprint` in their own validator before the closed field check and declare it in their input schemas — the converted Payments/Checkout families' idiom |
| Each `previewChange` caller asserts the preview invoice's mode at the call site | `previewChange` is the single choke point for plan/item/anchor previews | It takes an optional `mode` option and asserts it on the evaluated invoice when given; no-mode callers are unchanged. Schedule-creation and cancel previews, which do not flow through `previewChange`, assert at their own call sites |
| Only the two write wrappers carry TEST wording | The seven `billing_*` read descriptions in `src/tools/billing.js` were also TEST-worded, and two safety error texts named TEST | Reads were already LIVE-reachable through the PR #304 seam; this card makes their discount projections mode-correct, so the descriptions are de-TESTed with it. The two error texts (`verifyItemLedger`, `validSchedule`) are de-TESTed; no test asserted either string |
| A decision entry is expected if behavior choices arise | The only judgment call — the `discountSafe` no-mode fallback — is an implementation choice preserving existing callers, not an owner decision | No `docs/DECISIONS.md` entry; recorded here instead |
| TOOL-CATALOG billing entries state TEST-only conditions | The billing rows are mode-neutral plain English and state no condition this conversion makes false | No TOOL-CATALOG change |
| JIT cards are registered in `docs/pr-cards/work-index.json` | None of the merged V2 cards (SHARED, MONEY, DISPUTES, PAYMENTS, INVOICES) is registered there; the index validator passes without them | This card follows that precedent; no index change |
| A preview → approve → confirm sequence can mix argument sets | `previewFingerprint` is part of the idempotency payload (not in `src/stripe/client.js`'s OMIT set), so the money approval binds to the exact argument set that presented it | Test-fixture fact, already the predecessors' LIVE treatment: the change-plan credit test uses one consistent argument set (with a stable `requestKey`) for request, approval and execution. No code change resulted |

## Build contract, as built

- **No dispatcher change.** Area `billing` was already in
  `guardedLiveAreas` and `guardedTestAreas` in
  `src/core/profiles.js`; `profiles.js` is untouched and the
  profiles registry suite is the instrument proving no other
  area's admission or reachability changed.
- **Handler gates removed.** The TEST-only wrapper is gone
  from both write modules: the seven subscription writes
  (`billing_create_subscription`, `billing_update_subscription`,
  `billing_change_plan`, `billing_cancel_subscription`,
  `billing_undo_cancel`, `billing_pause_collection`,
  `billing_resume_collection` in `src/tools/billing-writes.js`)
  and the seven item/schedule writes (`billing_add_item`,
  `billing_update_item`, `billing_remove_item`,
  `billing_create_schedule`, `billing_update_schedule`,
  `billing_release_schedule`, `billing_cancel_schedule` in
  `src/tools/billing-item-schedule-writes.js`) now run the
  confirmed-action sequence in the connection's own mode.
- **Mode invariants in both directions.** Every provider
  object a write is evaluated against — customer, saved
  payment method, price, subscription, schedule, the linked
  subscription behind a schedule, and every `createPreview`
  invoice — and every read-back demands the connection's mode
  through `assertAccountResourceMode`. A LIVE connection
  meeting TEST objects refuses, and a TEST connection meeting
  LIVE objects refuses, with the shared mode-mismatch error.
- **Fingerprint-bound confirmation.** Both modules declare
  `previewFingerprint` in their input schemas and strip it in
  their validators; the shared lifecycle (PR #304) binds a
  presented fingerprint to the freshly evaluated state and
  refuses drift with the fresh preview and fingerprint,
  executing nothing.
- **Disclosure.** Tool descriptions are mode-neutral.
  Summaries lead with `LIVE MODE.` / `TEST MODE.` and disclose
  in plain words: subscription creation collects the first
  charge from the saved payment method when the subscription
  starts and renews each period until canceled; plan and item
  changes state the exact provider-computed preview total and
  the proration-line total; a period-end cancellation states
  the date it takes effect, that the customer keeps the
  service until then and is not charged again; an immediate
  cancellation states that service ends now (and whether a
  final invoice is issued); schedule creation states the first
  charge happens when the first phase begins at the schedule
  start.
- **Reads.** `src/tools/billing.js` threads the connection's
  mode into the subscription/item projections (through wrapper
  closures, never as a bare map callback) and
  `billing_preview_change` mode-checks the retrieved
  subscription and price and passes the mode into
  `previewChange`.
- **Aim checks preserved, byte-for-byte where they are
  contracts:** `billing_change_plan`'s `money:true` marking
  and its exact provider-derived invoice-preview requirement
  (rows 20–21 apply wherever the change collects immediately);
  the verified price/amount/mode/start checks in schedule
  creation; the at-least-one-item invariant on item removal;
  the profile plan-binding terms in the tools exports; the
  app-ownership guard. **The money wiring is untouched**
  (`src/tools/write.js`, `src/money.js`, `src/db.js` do not
  appear in this change). The customer balance credit/debit
  item is not part of this card (coordinator ruling 3: it is
  row-35 provider-derived-amount engineering with its own
  card); nothing here depends on it or touches it.
- **Shared-helper safety.** `billing-shared.js` is shared
  with the already-converted Disputes and Invoices families
  through `client()`; that seam is unchanged here. The
  projection changes are additive-parameter only, and the
  disputes and invoices suites were re-run green (below).

## Named tests

- `tests/unit/billing-live-conversion.test.js` (new, 23
  tests): all seven subscription writes and all seven
  item/schedule writes preview in LIVE (summary leads with
  `LIVE MODE`, a `WRITE-…` fingerprint is issued, zero
  provider writes) and confirm against that fingerprint
  exactly once, returning `done:true`, `mode:'LIVE'`; a TEST
  preview still leads with `TEST MODE`; fingerprint drift on
  `billing_change_plan` refuses with the fresh fingerprint
  disclosed and zero writes, and the fresh fingerprint then
  confirms; the `billing_change_plan` proration-credit money
  proof in LIVE — confirm alone moves nothing and records $0
  usage, and the exact decision-intent owner approval
  executes exactly once and counts 8500 cents against the
  day; wrong-mode objects refuse in both directions (LIVE
  context with TEST objects, TEST context with LIVE
  objects); discount verification — `discountSafe` verifies
  a discount only in its own mode and keeps the historical
  no-mode behavior, `subscriptionSafe` carries the mode into
  item-level discounts, and `billing_get_subscription`
  reports a LIVE discount as verified in LIVE.
- Pre-existing suites re-run with unchanged expectations:
  `billing-write-contract`, `billing-item-schedule-write-contract`,
  `workflow-billing-completion`, `workflow-money-snapshot`,
  `profiles`, the three disputes suites, `mode-client`,
  `invoice-lifecycle-contract` and `creditnote-contract`
  (11 files, 263 tests at the pre-change baseline; all still
  green after the conversion and after the rebase onto
  PR #311), then the full unit suite and `npm run check`.
  Database suites are exact-head CI's route on this machine
  (local PostgreSQL binaries are absent); no local DB result
  is claimed.

## Done when

All fourteen operations run the full confirmed-action
sequence on synthetic LIVE fixtures; the plan-change
preview/amount proof is demonstrably unrelaxed; docs updated
(STATUS, conformance row 17 V2 progress note, COMPLETION;
TOOL-CATALOG and DECISIONS needed no change, per the drift
table). **Live proof remains open** (CAP-5 queue):
source/synthetic only; no real subscription is created or
changed by this card, no account is enabled, and no LIVE key
is used.
