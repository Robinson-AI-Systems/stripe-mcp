# OWNER-OBEDIENCE V2 — RADAR (family 7)

Status: **SOURCE-IMPLEMENTED 2026-11-04; live proof remains open in the CAP-5
queue.** This card converts the Radar write family from TEST-only to the
connection's mode under conversion V2 (conformance row 17, convertible veto:
LIVE write allowlists / TEST-only handlers). It completes no predefined batch
subsection in `docs/pr-cards/README.md` — the README keeps its existing V2 row
until the coordinator's closeout, as with the Money, Disputes, Payments,
Invoices, Billing and Checkout cards.

## Scope

Five tools in the `risk` area:

- `radar_approve_review` and `radar_create_value_list`
  (`src/tools/radar-writes.js`);
- `radar_delete_value_list`, `radar_add_list_item` and
  `radar_remove_list_item` (`src/tools/radar-list-lifecycle.js`).

These tools approve fraud reviews and maintain the value lists Stripe's Radar
rules match payments against. No money moves through this module — approving a
review releases a held payment to Stripe's own capture path, and list changes
only change what future payments are blocked, allowed or reviewed. No money
wiring (`src/tools/write.js`, `src/money.js`, `src/db.js`) is touched. The
Radar *read* tools are not converted here: they stay TEST-only, as the census
places read reachability outside this family's write conversion.

## Baseline and drift check

Design baseline: current `main` after PRs #303–#312 (V1, the V2 shared
machinery, V4, Money, Disputes, CI speed, Payments, Invoices, Billing); the
branch was rebased onto PR #313 (Checkout, family 6) before landing, as the
coordinator's brief requires when main moves during a build. The design card
(`card-radar.md`) and the census (family 7) were checked against that baseline
before editing. Material drift found and resolved:

| Design-card assumption | Baseline truth | Resolution |
| --- | --- | --- |
| Dispatcher admission may be needed for the family | The `risk` area is already in `guardedLiveAreas` (`src/tools/live-guard.js`) | No dispatcher or `src/core/profiles.js` change |
| Converting the handler gates and the modules' own `livemode` comparisons is sufficient | A fourth, hidden TEST gate sits in the shared safe projections: `checked()` in `src/tools/radar-reads.js` required `livemode === false`, and it backs `reviewSafe`, `valueListSafe` and `valueItemSafe`, which the write preflights and verifications call — a LIVE object could never verify even with the handler gates removed | The projections take an optional `mode` argument (the Billing family's `discountSafe(v, mode)` precedent): `v.livemode` must equal the supplied mode, and the refusal message names that mode. The write modules pass their connection's mode; the read handlers call without one, so read behavior is byte-identical to before |
| Fingerprint confirmation works once the schemas admit `previewFingerprint` | The family's read functions validate arguments with the shared `validateFields` (billing-shared), which rejects any field outside the per-tool property set — `previewFingerprint` included — so a fingerprint confirmation would throw before reaching the core check | Family-local resolution (the Payments idiom): both write modules strip `previewFingerprint` from a shallow copy before validation, and both control schemas declare it |
| Mode-shaped ID patterns may exist (the Checkout species) | None: the review (`prv_`), list (`rsl_`) and item (`rsli_`) patterns are mode-neutral | Nothing to widen; recorded as checked |
| Value-list previews "must state the list type (block/allow) and the exact item being added or removed" (design card / census) | The module's standing privacy invariant — in both module headers, the G-3a safe-read design, and the pre-existing tests — forbids raw item values in previews, results and audit records: a listed value is typically a customer's email, card fingerprint or IP address | **Privacy wins; flagged for coordinator ruling.** Previews identify the item exactly by its Stripe ID, its type and its parent list, state the value's length (add path, as before), and state the plain-words consequence in the connection's mode. The raw value appears in no preview, result or audit record — proven by the new LIVE add/remove tests, including an audit read-back. If the coordinator rules the design card's letter should prevail, the change is confined to the two `summarize` functions |
| A decision entry is needed | None was, beyond the drift resolutions above (the preview-content point is recorded here for the coordinator's ruling, not decided unilaterally) | `docs/DECISIONS.md` unchanged |

## Build contract (as built)

- **Wrapper gates removed.** The three handler-layer TEST refusals are
  deleted: `radar_approve_review` and `radar_create_value_list` in
  `radar-writes.js`, and the shared lifecycle handler gate in
  `radar-list-lifecycle.js`. Handlers now dispatch directly. Under a LIVE
  connection the guarded-write pipeline's existing rules decide: `full`
  profile only, catalog listing, customer context, a live-enabled and
  live-connected account, owner-approved LIVE, and a binding preview
  fingerprint. A bare LIVE connection (and any read-only profile) is refused
  by the core LIVE-enablement guard / profile check before anything executes —
  the pre-existing guard tests assert exactly that outcome, unchanged.
- **Mode invariants, both directions.** Every evaluated object — the review,
  its linked charge or payment intent (`assertAccountResourceMode`), the
  parent value list, the list item, the created list's identity, the created
  item's response — and every read-back verification demands equality with the
  connection's mode. A TEST object under a LIVE connection, or a LIVE object
  under a TEST connection, stops the call before any write, or leaves it
  unconfirmed when the mismatch appears in the provider's create response.
- **Verified facts still gate the write.** The review must be exact and open;
  the list-create alias must verify as unused (the one pre-existing message
  assertion, `/alias is unused/`, is preserved); the delete path still proves
  emptiness twice (the list's own counters and an independent item page); the
  add path still validates the value against the list's item type; the remove
  path still verifies the item's parent list.
- **Disclosure.** Every tool description is mode-neutral and ≤ 160
  characters. Summaries open with `LIVE MODE. ` or `TEST MODE. ` and state
  the plain-words consequence:
  - review approval: approving "releases the held payment: this irrevocably
    closes manual review and may allow the pending payment to be captured
    and settled";
  - list creation (LIVE): rules using the list act on real payments — a block
    rule refuses real customers whose payment matches a listed value, and an
    allow rule lets them through;
  - item add (LIVE): a block rule "refuses the real customer at checkout";
  - item remove (LIVE): the removed value "stops being blocked or allowed by
    rules using this list, so matching real customers are no longer stopped
    by it";
  - list deletion: the list is verified EMPTY, so deleting it "stops no value
    being blocked or allowed by itself", and no rules referencing it may
    remain.
- **Privacy invariant preserved.** Raw item values never appear in previews,
  results or audit records, in either mode (see the drift table).
- **Money discipline.** No money wiring is touched; a name-only diff over
  `src/tools/write.js`, `src/money.js` and `src/db.js` is empty.

## Named tests

- `tests/unit/radar-writes.test.js` (10 tests: 6 pre-existing, expectations
  unchanged; 4 new): LIVE review approval — preview discloses the release in
  LIVE words and issues a fingerprint, confirmation approves exactly once;
  fingerprint drift refusal (the linked payment's state changes after preview
  → refused with a fresh fingerprint, zero provider writes, the fresh
  fingerprint then confirms); LIVE list creation (preview names the alias and
  the real-payment consequence, creates exactly once); wrong-mode provider
  objects refused in both directions (TEST objects under a LIVE connection
  refuse at read; a wrong-mode create response leaves the write unconfirmed;
  mirrored under a TEST connection).
- `tests/unit/radar-list-lifecycle.test.js` (12 tests: 7 pre-existing,
  expectations unchanged; 5 new): LIVE delete of a verified-empty list
  (preview states the consequence; exactly one provider delete); LIVE item
  add (preview states that a block rule refuses the real customer; the raw
  value appears in no preview, result or audit summary); fingerprint drift
  refusal on add (parent list changes after preview → refused, zero writes);
  LIVE item remove (preview states what stops being blocked; exactly one
  provider delete); wrong-mode provider objects refused in both directions
  for all three operations, with zero provider writes.
- `tests/unit/radar-reads.test.js` (5 tests, unchanged): the safe projections
  keep their historical TEST-only behavior when called without a mode.
- `tests/unit/profiles.test.js` passes: the registry instrument — no caller
  outside this family changed reachability.
- Full unit suite and `npm run check` green on the final tree; the
  conflict-marker grep is empty and `git diff --check` is clean. DB and mock
  suites are exact-head CI's route on this machine (no local PostgreSQL).

## Done when / acceptance

- [x] All five tools preview and confirm in both modes under the existing
  guarded-write rules, with mode invariants on every evaluated object and
  read-back, in both directions.
- [x] The three handler-layer TEST gates and the hidden safe-projection TEST
  gate are gone; every pre-existing refusal (profile, bare LIVE, non-empty
  delete, alias in use, uncertain outcome, value validation) still fires.
- [x] Summaries are mode-labeled and state the plain-words consequence,
  including what a live list change does to real payments and what removing
  or deleting stops blocking; raw item values stay out of previews, results
  and audit.
- [x] No money wiring touched; `src/core/profiles.js` untouched; no caller
  outside this family changed reachability (the profiles registry test is
  the instrument and passes).
- [ ] Live proof: a real LIVE review approved and a real LIVE value list
  created, changed and deleted under an owner-approved LIVE connection —
  **left open in the CAP-5 queue; no real Radar object was touched for this
  card.** Source implementation is not live acceptance.

## Coordinator ruling (2026-11-04) — preview identification versus the raw-value privacy invariant

The design card's wording ("previews must state the list type and the exact item being added or removed") is read as identification, and the privacy-preserving form built here PREVAILS: the module's standing invariant — raw list values (customer emails, card fingerprints, IP addresses) appear in no preview, result, or audit record — is a deliberate protection of other people's data and is not relaxed by a wording in a design card. Previews identify the item exactly by Stripe ID, item type, and parent list, state the value's length on the add path, and state the plain-words live consequence. A future change that wanted raw values in previews would be a new owner-level decision, not a card amendment.
