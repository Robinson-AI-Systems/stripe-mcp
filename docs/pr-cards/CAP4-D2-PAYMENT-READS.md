# CAP4-D2-PAYMENT-READS — payment reads serve the connection's own mode with per-object verification

Status: **SOURCE-IMPLEMENTED.** Family D-2 of CAP-4 (Phase 1 of
the frozen sequence, third after D-3 and D-1). Read paths only:
no write handler's mode gate, ceremony, aim check or dispatcher
admission moves, and the money wiring (`src/core/write.js`,
`src/money.js`, `src/db.js`) is byte-untouched. Baseline: `main`
`e14e791a0b2dba3eed52a9c146ddca2af1449bb3` (PR #322,
CAP4-D1-MONEY-READS). Design record: the CAP-4 card set
(`card-payment-reads.md`, `census.md` §2/D-2, `sequence.md`) in
the coordinator's design folder; the family's write side is
OWNER-OBEDIENCE-V2-PAYMENTS (PR #310); the read idiom is the one
D-3 established and D-1 repeated (mode-threaded projections,
wrong-mode refuses the read, no-mode callers byte-identical).

## Scope

Ten tools, one gate site, four projections — all in
`src/tools/payments.js`:

- The module-local `guarded` wrapper refused every non-TEST
  connection before any provider call (throwing `TEST Stripe
  provider unavailable`); all 10 handlers sat behind it.
- The four projections (`paymentSafe`, `chargeSafe`,
  `refundSafe`, `setupSafe`) verified nothing: on a TEST
  connection a LIVE payment intent, charge, refund or setup
  intent projected without complaint. Refusal was the only thing
  between the family and LIVE; there was no verification in
  either direction.

Census trace: 13 operations claimed for D-2 in the reconciliation
appendix (charges ×5 including the nested refund spellings,
payment_intents ×4, refunds ×2, setup_intents ×2). Explicitly
not claimed: the two `setup_attempts` GETs — no native read tool
exists; they stay door-served (D-9's table), not absorbed here.
Payment-method reads belong to the customer family and are
already mode-aware; untouched.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The 10 tools are the census-named `payment_get_charge`, `payment_list_charges`, `payment_search_charges`, `payment_get_intent`, `payment_list_intents`, `payment_search_intents`, `payment_get_refund`, `payment_list_refunds`, `payment_get_setup_intent`, `payment_list_setup_intents` | The registry names are `charge_get`, `charge_list`, `charge_search`, `payment_get`, `payment_list`, `payment_search`, `payment_get_refund`, `payment_list_refunds`, `setup_get`, `setup_list` — the same 10 tools and the same 13 operations under shorter names | Naming drift, not a scope change (the D-3 precedent); this card uses the registry names throughout |
| The gate is a shared `testClient` helper at `payments.js:85` throwing "TEST Stripe reads only" (derivation/census A8) | The seam at `:85` is a module-local `guarded` wrapper throwing `TEST Stripe provider unavailable` for any non-TEST mode; there is no shared `testClient` in the module. Line `:85` is where the census said the gate lives — the gate's *form* drifted, not its position or effect | Convert the wrapper's contract (client resolution moves to the shared `modeClient` seam), as the design card directed ("convert the helper's contract, not ten call sites") |
| V2 (PR #310) gave the read handlers in this module mode assertions | V2's conversion was confined to `src/tools/payment-writes.js`; this module's reads carried no mode assertion anywhere at baseline — the coordinator brief's parenthetical misstates the file | Recorded here so the record is exact: D-2 adds the read side's first mode assertions; no V2 read work is redone or disturbed |
| The read ID validation is TEST-shaped and needs widening (the species the Checkout build found in its write schemas) | Hunted for and **not present**: the argument IDs validate by bare prefix only (`pi_`, `ch_`, `re_`, `seti_`, `cus_` + alphanumerics) — real Stripe IDs carry no mode segment, so the patterns are already mode-neutral; the `starting_after` cursor pattern is likewise generic | No schema change; the hunt and its negative result are recorded so the next family does not re-litigate it |
| A shared projection elsewhere hard-refuses live objects for these reads (the species the Radar build found) | Hunted for and **not present**: the four projections are used only inside this module (no external importer exists), and none of them branches on `livemode` at baseline | The projections are parameterized in place; no second module moves |
| The pre-existing suite's LIVE-refusal expectation encodes the wrapper gate | `tests/unit/payments.test.js` asserts `payment_get` on a `mode:'live'` connection `isError`. After conversion the same outcome is produced by the LIVE-enablement path itself: the fixture connection is not an independently enabled LIVE account (no production deployment marker, no `db.getStripeAccount`), so `selectedAccountClient` refuses before any provider object is touched | Assertion unchanged and passing — the refusal still fires, now for the converted reason (the V2-PAYMENTS drift pattern) |
| `paymentSafe` surfacing `receipt_email` conflicts with the program's raw-value privacy invariant | The invariant (Radar ruling) bars raw identifiers from entering previews/results **beyond their established safe-projection shape**; `receiptEmail` is part of this projection's established shape at baseline, in TEST, and the field set is contractually frozen by the design card ("no field is added, removed, or renamed in either mode") | Field set kept exactly; the new suite proves the surfaces that were never in the shape — `client_secret` and the charge's card `fingerprint` — stay out in both modes |
| A modeless or unknown-mode connection keeps the old refusal | At baseline such a connection threw the wrapper's plain `Error('TEST Stripe provider unavailable')`, which the handler rethrows (only `TypeError` becomes a fail result) and the dispatcher turns into an error result | `modeClient` throws the identical message for the same cases; behavior is unchanged, including which errors become fail results (LIVE-enablement `TypeError`s) and which propagate |
| A decision entry is expected if behavior choices arise | The naming-drift adoption and the two negative hunts are recorded in this table; no behavior choice beyond the design card arose | No `docs/DECISIONS.md` entry, per the V2-BILLING, D-3 and D-1 precedent |

## Build contract, as built

- `src/tools/payments.js` — the `guarded` wrapper now resolves
  its client through the one shared mode-aware seam
  (`modeClient` in `src/tools/account-mode.js`): TEST resolves
  exactly as the module's helper always did (the connection's
  own service client, no extra provider read), LIVE resolves
  only through the verified selected-account path, and the
  connection mode is handed to each handler. The four
  projections gain the optional mode parameter and verify via
  `assertAccountResourceMode` before their historical shape
  checks (the D-1 placement) when the mode is `test`/`live`;
  list, get and search paths all pass it, so a wrong-mode member
  refuses the whole read. Field sets are byte-identical in both
  modes. The ten descriptions and the module header name both
  modes. No other module changes: the projections have no
  external importers, and no dispatcher, profile, registry or
  reachability change is made — the same 322 tools, the same
  profiles. No SQL, no schema, no Stripe operation added or
  removed.
- Verification semantics: a returned object whose present
  boolean `livemode` disagrees with the connection mode refuses
  the whole read (`Stripe provider resource mode mismatch`); an
  object with no `livemode` field passes, exactly
  `assertAccountResourceMode`'s established non-required
  semantics (the pre-existing fixtures rely on it). Wrong-mode
  is refused in **both** directions. Search pages verify
  per-object exactly like list pages (the design card's named
  point, pinned by dedicated search tests in both directions).

## Named tests

New suite `tests/unit/cap4-d2-payment-reads.test.js` (12 tests):

- **Payment intents:** LIVE list/get/search happy paths returning
  verified live objects with amounts exact; wrong-mode refusal
  in both directions on list, get **and search** (the search
  refusal asserted by message); no `client_secret` anywhere in
  any output.
- **Charges:** LIVE list/get/search happy paths (outcome summary
  projected); wrong-mode refusal in both directions on all three
  paths; the raw fixture carries a card `fingerprint` and no
  output in any mode contains it.
- **Refunds:** LIVE list/get happy paths with the exact amount;
  wrong-mode refusal in both directions.
- **Setup intents:** LIVE list/get happy paths; no
  `client_secret` in any output; wrong-mode refusal in both
  directions.
- **Projection contract:** the four projections' field sets are
  asserted exactly (sorted key sets) in both modes; a supplied
  mode verifies (each projection refuses a wrong-mode object),
  and a no-mode call keeps the historical behavior — a
  no-`livemode` fixture projects as before and a mode-carrying
  object passes unverified, the contract no-mode callers rely
  on.
- **Descriptions:** all ten name both modes (`TEST or LIVE`),
  claim neither alone, and stay within the 160-character listing
  budget.
- **Baseline record:** 11 of the 12 fail at baseline `e14e791a`
  — every LIVE happy path (the baseline guard threw its
  TEST-only refusal), every wrong-mode refusal in both
  directions (on TEST the object projected unverified; on LIVE
  the guard threw instead of verifying), the projection mode
  contract, and the descriptions. The 1 that passes at baseline
  is the field-set test: it pins the historical projection
  shapes the conversion must not move, and passes after for the
  same reason — unchanged by design.
- **Regressions standing:** the pre-existing `payments` suite
  passes unchanged (including the LIVE-refusal assertion, now
  produced by the LIVE-enablement path); the focused neighbor
  suites pass unchanged — `payments-live-conversion` and
  `payment-write-contract` (the V2 write family),
  `mode-client`, `registry` (322 tools), `profiles`,
  `workflow-refund-confirmed`, `dev-seed-refund-contract`,
  `money-reservation` — 115 tests; and the full unit suite
  passes: 201 files / 2,121 tests (baseline 2,109 + this
  card's 12).

Database tests are exact-head CI's route: this build environment
has no local PostgreSQL binaries (`session:prepare` reports
`localPostgresBinaries: false`), and no database code changes
here.

## Acceptance

- All 10 tools serve TEST and LIVE connections with per-object
  mode verification on list, get and search paths; wrong-mode
  objects are refused in both directions; a LIVE payment read
  never projects a TEST-mode object.
- Every pre-existing read expectation stands; TEST output shapes
  are byte-identical (field sets asserted exactly; the rest are
  covered by the unchanged pre-existing suites).
- **Live proof stays open in the CAP-5 queue:** on the owner's
  own LIVE connection after a checked release — one charge, one
  payment intent, one refund and one setup intent read back as
  verified live objects, per the design card's Done-when. This
  card claims source implementation only.
- The CAP-4 work-index entry names this card while D-2 is the
  family's current unit (the D-3/D-1 registration pattern);
  COMPLETION's CAP-4 section and the conformance progress note
  record D-2 with this card.

## Done when

- The guard is converted and all four projections verify, the
  new suite and the full unit suite pass, `npm run check` is
  green, and the docs named in this card are updated. The
  successor inherits: D-4 (dispute and event reads) next in the
  frozen Phase 1 sequence.
