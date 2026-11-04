# OWNER-OBEDIENCE-V2-PAYMENTS — LIVE payments and refunds confirmed-action conversion

Status: **SOURCE-IMPLEMENTED.** Family 3 of 13 of conformance
row 17, conversion **V2** (appendix mechanism 28). This is
corrective work inside the already-merged payment write
choreography (card #38); it completes no predefined batch
subsection and must not be counted as one.
Baseline: `main` `91cca60bbc2cbd6484c7217f032aedfbe9cc1e77`
(after PRs #303, #304, #305, #306, #307, #308). Design draft:
`~/workspace/stripe-v2-design/card-payments.md`; census:
`~/workspace/stripe-v2-design/census.md` Family 3.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The handlers still carry their own TEST-only provider helpers for the modeClient seam to replace | PR #304 (OWNER-OBEDIENCE-V2-SHARED) already landed the seam in this file: `read`, `apply` and `readAfter` already resolve through `modeClient` (`src/tools/account-mode.js`), the local helper is already deleted, `validate()` already strips `previewFingerprint` as a control field and every tool schema already declares it | No seam or fingerprint work in this card; the remaining conversion is the wrapper gate, the mode invariants, the summaries and the descriptions |
| Dispatcher admission needs converting | Area `payments` is already in `guardedLiveAreas` (`src/core/profiles.js`); `payment_cancel_refund` is already `full`-profile only and keeps its `destructive: true` flag | No `profiles.js` change; `tests/unit/profiles.test.js` run unchanged to prove admission was already correct, including that no other caller's reachability changed |
| Refund conversion might need the money wiring or the app-owned-target guard touched | It does not: the refund's `money: 'out'` spec, `src/tools/write.js` (prepare/reserve/settle binding), `src/money.js` and `src/db.js` `reserve_money_out_guarded` are all byte-untouched, and the app guard's refund exception for the rental app's own charges is preserved automatically | No blocker; the conversion is confined to `src/tools/payment-writes.js` plus tests and docs |
| LIVE-mode request shapes are validated by `tests/mock/payment-write-contract.test.js` (design card) | That file does not exist. The real mock suite is `tests/mock/payments.test.js` (TEST mode only), and no live-mode mock test exists anywhere in the repo | Recorded as drift, suite left unchanged: the `apply` payloads are mode-independent, so TEST-mode shape validation against stripe-mock covers them, and a fake `sk_live_` key in the tree would risk the secret scan for no added proof. LIVE behavior is proven by the new fake-provider unit suite instead |
| Invariants are TEST-baked refusals to parameterize (design card) | `target()` and `verify()` checked no `livemode` at all — the mode equality simply did not exist in this family | Added, not parameterized: every retrieved target (customer, saved payment method, payment intent, charge, refund and its charge, setup intent, and the intent resolved from a refund's `paymentId`) and every read-back now demands the connection's own mode in both directions, via the shared `assertAccountResourceMode` at read and an equality check in `verify`. Existing fixtures carry no `livemode` fields, so the invariant refuses only a present, disagreeing mode |
| The existing suite's bare-LIVE expectations encode the wrapper gate | They assert refusal outcomes (READ ONLY / LIVE / mixed-batch) for a connection that is not LIVE-enabled; after conversion the same outcomes are produced by the LIVE-enablement guard (`authorizeLiveWrite`: non-production deployment / account not independently enabled and connected) | Assertions unchanged — the refusals still fire, now for the correct reason; enabled-LIVE behavior is proven by the new LIVE fixtures |
| The shared seam suite (`tests/unit/mode-client.test.js`, PR #304) asserts this family's wrapper refusal by name ("TEST-only payment and refund operation") | That suite's own header scopes the assertion to the period "until their family conversions"; this conversion is that event for payments. The checkout half of the same test is untouched (checkout has not converted) | The payments expectation now asserts the LIVE-enablement guard's refusal text — the same outcome (a bare, non-enabled LIVE connection executes nothing) produced by the correct mechanism. The assertion's strength is unchanged; it is the one pre-existing expectation this conversion retires, anticipated by the shared card itself |

## Build contract, as built

- `src/tools/payment-writes.js`: the TEST-mode wrapper gate at
  the end of `build()` is gone (and the now-unused `gone` import
  with it). The nine operations — `payment_charge_saved_method`,
  `payment_capture`, `payment_cancel`, `payment_update`,
  `charge_update`, `payment_create_refund`,
  `payment_update_refund`, `payment_cancel_refund`,
  `setup_cancel` — now run the shared confirmed-action sequence
  in the connection's own mode: provider-derived preview,
  plain-words disclosure, confirmation bound to the preview
  fingerprint, re-check at execution, existing journal and
  read-back.
- Mode invariants: `target()` asserts every provider object it
  reads with `assertAccountResourceMode` against the
  connection's mode (a present, disagreeing `livemode` refuses
  the read in both directions); `verify()` refuses a read-back
  whose `livemode` disagrees with the connection's mode. No
  pre-existing invariant was removed or weakened.
- Disclosure: summaries are mode-labeled (`LIVE MODE.` /
  `TEST MODE.`) and each states in plain words what will happen
  to the customer's card or payment if confirmed — the charge
  amount taken from the saved method, the capture amount, the
  cancellation's release of the authorization, the refund amount
  and its destination (back to the customer's original payment
  method), and that the metadata-only updates move no money.
- Tool descriptions de-TESTed to neutral wording (all within
  the 160-character listing budget).
- Refunds stay money-out through the existing guarded money
  contract only: provider-derived amount
  (`a.amountCents ?? before._refundableCents`, USD only), exact
  owner approval, the shared daily cap and the atomic
  reservation bind exactly as before. `src/tools/write.js`,
  `src/money.js` and `src/db.js` are byte-untouched, as is the
  app-owned-target guard and its refund exception.
- No decision was needed beyond the recorded drift resolutions;
  `docs/DECISIONS.md` is unchanged. `docs/TOOL-CATALOG.md`
  payment rows state no TEST-only condition, so they are
  unchanged.

## Named tests

- `tests/unit/payments-live-conversion.test.js` (new, 9 tests):
  LIVE preview → confirm happy paths on a fake provider and
  fake database for all nine operations on `livemode: true`
  fixtures; the previews are mode-labeled, disclose the amounts
  and the refund destination, and carry a well-formed preview
  fingerprint; a drifted confirmation refuses with the fresh
  fingerprint disclosed and executes nothing, then confirms with
  the fresh fingerprint; a TEST-mode object under a LIVE
  connection is refused at read before any write, and a
  LIVE-mode object under a TEST connection is refused the other
  way; the refund approval path is proven end to end — confirm
  alone moves nothing and uses none of the day, and the exact
  owner approval granted through the decision-intent path
  executes exactly once and counts the full amount against the
  day.
- `tests/unit/payment-write-contract.test.js`: run with
  unchanged expectations, all passing — every pre-existing
  refusal (preview/confirm discipline, app-owned targets and
  the refund exception, owner consent, daily cap, bare-LIVE
  refusals) still fires.
- `tests/unit/mode-client.test.js`: the shared seam suite;
  its payments wrapper-refusal expectation is retired by this
  conversion per the drift table (now asserting the
  LIVE-enablement guard's refusal); its checkout expectation
  and all seam expectations are unchanged.
- `tests/unit/payments.test.js`,
  `tests/unit/money-reservation.test.js`,
  `tests/unit/money-owner-approval.test.js`,
  `tests/unit/profiles.test.js`,
  `tests/unit/workflow-refund-confirmed.test.js`,
  `tests/unit/dev-seed-refund-contract.test.js`: run with
  unchanged expectations, all passing — readers, money gates,
  dispatcher admission and the workflow refund delegate are
  unrelaxed.
- `tests/db/dispute-money-target.test.js`,
  `tests/unit/money-reservation.test.js`'s database-backed
  siblings and `tests/mock/payments.test.js`: unchanged;
  database and stripe-mock proof is exact-head CI's route on
  this machine (no local PostgreSQL binaries, per the session
  prepare result).
- Full unit suite and `npm run check` on the assembled tree.

## Done when

Met in source: all nine operations run the full
confirmed-action sequence on synthetic LIVE fixtures in tests,
with the refund's money gates demonstrably unrelaxed (the
pre-existing refusal suites pass with unchanged expectations,
and the new LIVE tests prove the approval path, drift and
wrong-mode refusals in both directions). Docs updated
(conformance row 17 V2 progress note, COMPLETION, STATUS).
**Live proof remains open** (CAP-5 queue): a real LIVE charge,
capture or refund happens only on a real account when the owner
elects to act; this family's proof is source/synthetic until
then. No account was enabled, no LIVE key was used, and no
real money moved.
