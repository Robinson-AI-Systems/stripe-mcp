# CAP4-D4-DISPUTE-EVENT-READS — dispute and event reads verify in the connection's mode

Status: **SOURCE-IMPLEMENTED.** Family D-4 of CAP-4 (the fourth
CAP-4 family built, in the frozen Phase 1 sequence after D-3,
D-1 and D-2). Read paths only: no write handler's mode gate,
ceremony or verification moves — the dispute writes
(OWNER-OBEDIENCE-V2-DISPUTES, PR #308) are untouched — and the
money wiring (`src/core/write.js`, `src/money.js`, `src/db.js`)
is byte-untouched. Baseline: `main`
`a8439e2d5aa0b92fe033da0d290d8a2941389057` (PR #323, CAP-4 D-2).
Design record: the CAP-4 derivation and card set
(`card-dispute-event-reads.md`, `census.md`, `sequence.md`) in
the coordinator's design folder.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The census and the design card name 5 tools: `dispute_list`, `dispute_get`, `event_list`, `event_get`, `event_list_types`, the fifth "a local catalog read" | No `event_list_types` exists anywhere in `src/` or the registry. The family's fifth registry tool is `event_list_undelivered`, a provider list read that shares the exact `list()` path with `event_list` (`events-read.js`) | **Naming drift, not a scope change** (the D-3 precedent): same 5 tools, same 4 census operations (disputes ×2, events ×2), same two modules. This card uses the registry names throughout; the undelivered list converts with the shared list path, and there is no separate local catalog read to convert |
| Gate and projection sites sit at the census lines (A4 `dispute-reads.js:54,61` + `disputeSafe` at `:7`; A5 `events-read.js:73,100` + `eventSafe` at `:33`) | All five sites are at exactly those lines at this baseline | No line drift for this family; the build converts exactly the enumerated sites |
| Two handler gates per family are the whole job | Both projections also hard-require TEST (`disputeSafe`: `d.livemode!==false`; `eventSafe`: `v.livemode!==false`) | Parameterize the projections with the connection mode (the shared-projection precedent); the gates are only half the diff, as the design card's own drift table states |
| Event payloads are safe to project as-is in LIVE | `eventSafe` projects the event's data-object identity (ID + type only) — the same minimal shape in both modes is the privacy posture | The projection shape is identical in LIVE; the embedded data object is not mode-verified (the projection consults no field of it beyond ID and type, in either mode) and its exposure is not widened |
| The D-3 projections' verification semantics carry over unchanged | D-3 used `assertAccountResourceMode`'s default non-required semantics (an object with no `livemode` field passes) because write-path fixtures rely on it. These two projections have always required `livemode===false` strictly — a dispute or event with no `livemode` field fails at baseline | The conversion passes `{required:true}` so the mode-supplied acceptance set is exactly the baseline set in TEST and its mirror in LIVE. Recorded here as this family's one deliberate difference from D-3's semantics, driven by byte-identical TEST behavior |
| Wrong-mode refusal text follows the family's historical strings | With a mode supplied, a wrong-mode object refuses with the shared `Stripe provider resource mode mismatch` (the D-3 idiom). The historical shape-failure strings (`Stripe TEST dispute metadata could not be verified`, `Exact TEST Stripe Event unavailable`) still fire for non-mode shape failures in either mode, and for every failure when no mode is supplied | Retained as historical wording, recorded here (the D-3 precedent); the tool descriptions — the behavior callers read — are all corrected |
| Removing the handler pre-gates changes nothing else | The pre-gates (`Dispute reads require TEST mode`, `TEST Event reads only`) were also the family's refusal for connections the seam cannot serve at all. After conversion those refusals come from the shared seam's LIVE-enablement path (`selectedAccountClient`) — the same outcome for the correct reason (the D-2 pattern) | The pre-existing suites' LIVE-refusal assertions pass unchanged, now produced by the enablement path |
| The dispute list projection receives the current time | At baseline `dispute_list` passes `disputeSafe` directly to `pageResult`, whose mapper invokes it as `(element, index, array)` — so the projection's `now` argument is the element **index** (0, 1, 2…), and list results' `daysLeft` is computed against ~epoch, while `dispute_get` uses real time. Verified by probe at baseline (`daysLeft: 19450` for the standard fixture in list position 0) | **Preserved bit-for-bit**: the list wrapper forwards the mapper's index as `now` exactly as the baseline did. This is not a mode defect and this card names no change to it; recorded here as an observed baseline quirk for a future card to judge on its own merits |
| `workflow_dispute_kit_save` (the composite whose record still says `mode:'test'`) is in this family's path | The V2 Disputes card assigned that composite to the CAP-4 composites work; the sequence places it in D-8 §B. The composite and `workflow-webhook-health` do call these handlers — through `workflow-read-common.js`'s TEST-only `verifyContext`, so their context mode is always `test` | Untouched, per the task boundary and the sequence. The converted handlers behave byte-identically for those TEST contexts, and both composites' suites pass unchanged in the full run |

## Build contract, as built

- `src/tools/dispute-reads.js` — the module header and both tool
  descriptions no longer claim TEST. `disputeSafe(d, now, mode)`
  gains the optional mode parameter: a supplied mode verifies the
  dispute via `assertAccountResourceMode(d, mode, {required:true})`
  before the historical shape checks; no mode keeps the historical
  `livemode!==false` term exactly. Handlers drop the TEST-only
  pre-gate (the seam behind `guarded` already resolves the client
  mode-awarely) and thread `ctx.connection.mode`: `dispute_list`
  through `(d, i) => disputeSafe(d, i, mode)` — the mapper index
  forwarded as `now`, preserving baseline list semantics
  bit-for-bit — and `dispute_get` through
  `disputeSafe(dispute, undefined, mode)` (the `undefined` keeps
  the projection's `Date.now()` default, as at baseline). The now
  unused `fail` import is removed.
- `src/tools/events-read.js` — `eventSafe(v, {detail, select,
  mode})` gains the mode option with the same rule (supplied mode
  verifies with `{required:true}`; no mode is the historical hard
  check). The shared `list()` helper drops its TEST-only pre-gate
  and threads the connection mode (converting `event_list` and
  `event_list_undelivered` together); `event_get` drops its
  pre-gate and threads the mode. All three descriptions no longer
  claim TEST. The now unused `fail` import is removed.
- Verification semantics: a returned object whose `livemode`
  disagrees with the connection mode refuses the whole read;
  wrong-mode is refused in **both** directions. The event's
  embedded data object is projected exactly as at baseline (ID +
  type only) in both modes.
- Privacy posture unchanged: dispute projections keep the
  minimal verified shape (identity, amount/currency, status,
  deadlines, submission count, charge/intent references — no
  evidence contents, no cardholder data); event projections
  never surface the embedded payload, the request object or the
  account field. Nothing is widened in either mode.
- No dispatcher, profile, registry or reachability change: the
  same 322 tools, the same profiles; reads that executed at
  baseline execute now, verified. No SQL, no schema, no Stripe
  operation added or removed.

## Named tests

New suite `tests/unit/cap4-d4-dispute-event-reads.test.js`
(17 tests):

- **Disputes:** LIVE list/get happy paths returning verified
  live objects with unchanged field sets; deadline and
  submission-count edge fixtures mirrored with `livemode:true`
  (submission count 2, past-due, under-review); a TEST dispute on
  a LIVE connection refused at the projection — proven at the
  projection, not the old gate, by asserting the provider was
  called; a LIVE dispute on a TEST connection refused in list
  and get; the `disputeSafe` mode/no-mode contract in both
  directions; TEST list output asserted exactly (full object,
  including the baseline `daysLeft` the preserved index-as-`now`
  semantics produce); private-evidence sentinels absent from
  LIVE outputs; descriptions name both modes.
- **Events:** LIVE list (summary and full detail) and get happy
  paths, including a field-selected detail read; LIVE
  undelivered list with the provider filter and the
  not-processing-proof note; a TEST event on a LIVE connection
  refused at the projection (provider called); a LIVE event on a
  TEST connection refused in list and get; the `eventSafe`
  mode/no-mode contract in both directions, including selection
  under a supplied mode; the embedded-object privacy shape on
  LIVE full reads (source ID present, sentinel, billing details,
  payment method and request ID absent); TEST list output
  asserted exactly; descriptions name both modes; the family's
  five registry tools pinned, all read-only.
- **Baseline record:** 11 of the 17 fail at baseline `a8439e2d`
  (every LIVE happy path, both TEST-on-LIVE projection refusals,
  both projection mode contracts, the LIVE event privacy shape,
  both description tests). The 6 baseline passes are: the two
  TEST-direction refusal tests (the projections' hard check
  already enforced that direction), the two byte-identical TEST
  output pins and the reachability pin (pass at baseline and
  after by design), and the LIVE dispute privacy test, which
  passes vacuously at baseline because the gate refused
  everything — it gains its meaning after conversion, when real
  LIVE projections still leak nothing.
- **Regressions standing:** the pre-existing `dispute-reads`
  (4 tests) and `events-read` (6 tests) suites pass unchanged —
  their baseline LIVE-refusal assertions still fire, now through
  the LIVE-enablement path — as do `registry` and the dispute
  write suites within the full run: **full unit suite 202 files
  / 2,138 tests, all passing** (baseline 2,121 + 17 new), and
  `npm run check` green on the assembled tree.

Database tests are exact-head CI's route: this build environment
has no local PostgreSQL binaries (`session:prepare` reports
`localPostgresBinaries: false`), and no database code changes
here.

## Acceptance

- A read on a LIVE connection never projects an object whose
  `livemode` disagrees with the connection, in any of the 5
  tools; the same holds in reverse on a TEST connection.
- Every pre-existing read expectation stands; TEST output shapes
  are byte-identical (asserted exactly for `dispute_list` and
  `event_list`; the rest are covered by the unchanged
  pre-existing suites).
- **Live proof stays open in the CAP-5 queue:** on the owner's
  own LIVE connection after a checked release — a LIVE dispute
  list/get read and LIVE event list/get/undelivered reads
  returning verified live objects, and a wrong-mode-object knock
  test (a TEST object presented to a LIVE read is refused). The
  dispute family's live proof is additionally subject to a real
  LIVE dispute existing, as the V2 Disputes card recorded. This
  card claims source implementation only.
- Docs in step: STATUS top entry, COMPLETION's CAP-4 section
  (D-4 bullet, family summary line, remaining order), the
  conformance record's CAP-4 progress note, TOOL-CATALOG's
  dispute and event read rows (their TEST-only conditions were
  the ones now false), and the work index's CAP-4 card pointer.

## Done when

- The 5 tools verify in both modes, the new suite and the full
  unit suite pass, `npm run check` is green, and the docs named
  in this card are updated. The successor inherits: D-5
  (checkout reads) next in the frozen Phase 1 sequence; Connect
  (Phase 2) proceeds in parallel under its own card.

## Publication addendum (coordinator, 2026-11-04)

Rebased onto `main` at `8b9f4c4` (Connect slice 1, PR #324, included) for publication, the combined tree's everyday catalog measured **20,005 tokens** against the 20,000 budget — Connect slice 1 had fitted its own family to 19,975 on its baseline, and this family's dual-mode descriptions added the rest. Four of this family's five descriptions were tightened (filler removed; both modes and every behavior clause retained, so the description tests' contract is unchanged) and the catalog now fits. No test was weakened and the cap did not move — the same disposition as Connect slice 1's flagged budget trade. The rebased tree was then re-verified in full (unit suite and `npm run check`) before push.
