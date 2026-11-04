# CAP4-D8B-DISPUTE-KIT-SAVE — §B: `workflow_dispute_kit_save` follows the connection mode

Status: **SOURCE-IMPLEMENTED.** Family D-8 §B of CAP-4, the
sibling unit coordinator ruling 2 split from D-8 §A: the one
write composite the frozen D-8 card's §B named, converted under
the V2 write idiom as its own unit — never folded into §A's read
diff. Baseline: `main`
`b3e3969d20ef7007e07debd2acec6992708f1098` (PR #333, the
owner-ordered release route; the tree also carries §A as PR
#334). **§B completes D-8 and the CAP-4 Phase 1 read+workflow
scope.** Money wiring (`src/tools/write.js`, `src/money.js`,
`src/db.js`) is byte-untouched; no db.js schema change was
needed or made; the registry stays 329 tools, writes still 155.

## What the baseline save actually persists (read first, then converted)

The save stores **no local kit record**: §A's inventory already
established the composites persist no workflow state in
`src/db.js`, and the save is no exception. Its persistence is
(1) the guarded native write `dispute_save_evidence` — a
`defineWrite` that stages draft evidence on the Stripe dispute
itself with `submit: false`, journaled through the write
lifecycle's own audit record — and (2) the returned kit result,
whose `mode` stamp §A already made connection-following inside
`examine()`. The native writer was **already mode-converted**
in V2 (its target check demands `livemode` equal to the
connection's mode, its client is the mode-matched seam, its
summary names the mode): the only TEST-shaped layer left was
the composite's own gate and its examination defaults. §B
converts exactly that layer, so the Stripe-side draft now lands
in whichever mode's dispute the connection selected, partitioned
by mode exactly as the provider partitions it — a TEST kit and
a LIVE kit for the same dispute id are different provider
records, and nothing re-stamps either.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| §B's hazard is the shared gate: `writable()` calls the TEST-only `verifyContext` before any composed read (§A's preservation-clause finding) | True — and the save also composed `examine()` under its legacy defaults, the second TEST-shaped layer | Split route both times: `writableMode` beside a byte-identical `writable`; the save passes the mode-aware verifier into `examine()` |
| The save persists a kit record carrying a `mode: 'test'` stamp for this card to convert | No local kit record exists (§A's inventory: the composites persist no workflow state in `src/db.js`); persistence is the native writer's Stripe-side draft, and the returned kit's stamp already followed the connection since §A | The conversion lands on the composite's gate/examination layer; the draft partitions by provider mode; nothing is re-stamped |
| The native writer is TEST-shaped like the composite | `dispute_save_evidence` was already mode-converted in V2: its target check demands the dispute's `livemode` equal the connection's mode, its client is the mode-matched seam, and the defineWrite core's LIVE guard gates the confirm | Untouched — the composite was the only TEST-shaped layer left |
| §A's `examine()` parameter design suffices for the save unchanged | Almost — but `examine()` records the agreement gap on every app-supplied LIVE kit (ruling 4), and baseline staging refuses on any gap, which would refuse every app-supplied LIVE save categorically | The save's staging rule excuses exactly that one recorded gap on LIVE only, with every dispute-level staging fact re-checked; TEST is unchanged |
| A schema-bearing persistence change might be needed (the brief's named stop-and-flag case) | None found: the save writes through the native writer's existing journal and stores nothing locally | `src/db.js` byte-untouched; the flag case did not arise |

## The conversion (V2 write idiom, split route as in §A)

- **Gate.** `save()` entered through `writable()`, whose
  `verifyContext` is TEST-only — the same shared-gate hazard
  §A's preservation clause answered with a split. §B takes the
  same route one level up: a new `writableMode(ctx)` sits
  beside `writable` in `workflow-customer-actions.js`,
  substituting `verifyModeContext` and the connection's mode
  word over the identical profile (`everyday`/`full`) and
  audit-database (`db.recordChange`) checks. `writable` is
  byte-identical; the other five write composites keep it and
  keep refusing LIVE contexts with the exact baseline gate
  text — pinned by §A's updated preservation test and by the
  unchanged write-composite suites.
- **Examination.** The save now composes §A's converted
  `examine()` with `{verify: verifyModeContext, word:
  modeWord(ctx)}` — the same call the READ handler makes — so
  the dispute, charge, customer and any invoice are verified as
  belonging to the connection's mode and selected account
  before anything is staged; a wrong-mode dispute refuses and
  nothing persists (pinned in both directions).
- **Validation wording.** `validate(a, true, modeWord(ctx))`:
  the one mode word in the save's validation substitutes from
  the connection (TEST byte-identical).
- **Writer.** `readyStep`/`nativeWrite` and the native
  `dispute_save_evidence` are untouched: the preview/confirm
  fingerprint flow, the `requestKey + ':draft'` idempotency
  shape, the done/confirmed/evidenceSubmitted verification and
  the uncertain-outcome warnings are exactly baseline. On LIVE
  the native write additionally passes the defineWrite core's
  own LIVE guard (production deployment, owner-granted LIVE
  access, independently enabled+connected account) — that
  machinery is V2's and is not this card's to move.
- **TEST byte-identity.** On a TEST connection every layer
  above reduces to the baseline call: `verifyModeContext`
  admits TEST with the identical texts, `examine()` with the
  mode verifier returns the identical kit (§A proved the read
  side), and the staging rule below never engages. The new
  suite pins the TEST preview/confirm flow, the refusal texts
  and the app-bound save byte-for-byte in behavior.

## The one semantic decision: the agreement gap on a LIVE save

`examine()` records a gap whenever the app-agreement link
cannot verify, and baseline staging refuses on any gap. On
LIVE the link route is **categorically** unavailable —
`project_record_link` stays TEST-gated until the owner-surface
migration (coordinator ruling 4) — so an app-supplied LIVE
examine always records
`app_agreement_link / guarded_profile_route_unavailable`
(§A pinned exactly this on the read). Read literally, baseline
staging semantics would therefore refuse every app-supplied
LIVE save for a reason that is not a per-record verification
failure but a known, recorded route boundary. §B's rule,
narrow by construction:

- On a **LIVE** connection, when the examine's gaps are
  **exactly** the agreement-link gap, that gap alone does not
  block staging: it is recorded on the saved kit's `gaps` and
  the agreement stays on its checklist (`Signed agreement:
  open verified app record and attach actual document`), with
  `agreement: null` stated honestly. No LIVE route for the
  link is improvised; the saved kit claims no agreement.
- Every other gap still blocks on LIVE, and every
  dispute-level staging fact is re-checked before the excuse
  applies (needs response, zero prior submissions, deadline
  in the future, not past due) — an expired or already-answered
  LIVE dispute with an app still refuses, pinned.
- On **TEST** nothing is excused: a failed link remains a
  genuine verification gap and the save refuses on
  prerequisites exactly as at baseline — pinned, including the
  wrong-account binding case (the app profile bound to a
  different account than the connection selected), which is
  the baseline wrong-account refusal and is unchanged.

`examine()` itself is not modified: its `canStageDraft` and
`complete` keep their baseline meaning in both modes (the
saved LIVE kit honestly shows `complete: false` alongside its
recorded gap); the staging decision is the save's own, where
the frozen card put it.

## Gates found (enumerated or not) and dispositions

- `writable()` / `verifyContext` (enumerated by the card):
  split, above. `writable` byte-identical.
- `examine()`'s legacy defaults (enumerated by §A's card as
  §B's seam): the save now passes the mode-aware verifier,
  exactly the conversion §A's parameter design anticipated.
  The other legacy-default write caller (`workflow_webhook_
  health_fix` via `source()`) is untouched.
- `validate()`'s TEST word (unenumerated in the card; §A
  converted the same word on the read path): mode-word
  substitution, TEST byte-identical.
- The native writer's app guard (found in the build, not in
  the card): on an account bound to a known app profile, the
  guarded native write refuses unless the caller passes the
  owner's `outsideApp: true` override — baseline behavior of
  `dispute_save_evidence`, unchanged; the composite already
  carries the flag through its stage. The new suite's
  app-supplied saves pass it, as real callers must.
- The defineWrite LIVE guard (`authorizeLiveWrite`, found in
  the build): the LIVE confirm path meets V2's own production/
  owner-grant/account-state checks inside the native write.
  Untouched, and named here so the CAP-5 LIVE row knows the
  save's LIVE proof exercises it.
- No schema-bearing persistence need was found: the named
  stop-and-flag case did not arise. The save writes through
  the native writer's existing journal; `src/db.js` is
  byte-untouched.

## Tests

New suite `tests/unit/cap4-d8b-dispute-kit-save.test.js`
(12 tests):

- **TEST baseline contract (5, all pass at baseline by
  design):** preview+confirm end-to-end with baseline result
  shape, fingerprint and `submit: false` proof; refusal texts
  byte-identical; the app-bound save staging with its verified
  agreement link; the wrong-account binding refusal; the
  TEST-direction wrong-mode refusal (the D-4 verified read's
  mechanism, unchanged).
- **LIVE conversion (5, all fail at baseline):** preview+
  confirm end-to-end on LIVE (text and file evidence fields,
  draft read-back verified, exactly one `disputes.update`
  with `submit: false`); the wrong-mode refusal in the LIVE
  direction (baseline answers with the legacy TEST gate text;
  the conversion answers from the mode-aware examination);
  both gate layers substituting the LIVE word (context
  verifier and write-profile/audit refusal); the app-supplied
  LIVE save recording the agreement gap on the saved kit and
  staging on that basis; the same save refusing when the
  dispute itself cannot stage (expired deadline).
- **Mode-partitioned persistence (2):** a kit saved in TEST
  reads back in TEST with its staged state and is never
  re-stamped or mutated by a LIVE read of the same dispute
  id — the LIVE read is served the LIVE dispute (its own
  unstaged record, stamped `live`). This is the faithful
  no-re-stamping pin for §B: the composite stores nothing
  locally (§A inventory), so persistence is the provider's
  mode-partitioned draft itself, and the pin proves the
  partitions never bleed. The registry pin (guarded write,
  either-mode description) fails at baseline on the
  description and passes after.

**Honest baseline accounting.** Run against a pristine
baseline checkout (`b3e3969d`) with only the test files added,
the new suite fails 6 of 12 and passes 6: the failures are the
five LIVE-conversion tests and the description pin — the
conversion's substance; the passes are the five TEST-contract
tests and the partition test, by design (they pin baseline
behavior — that is their purpose). One pre-existing suite is
edited: §A's write-preservation pin
(`cap4-d8-workflow-read-composites.test.js`) drops
`workflow_dispute_kit_save` from the legacy-gate attempt list
— the D-7 precedent (a LIVE leg updated to the
post-conversion contract) — because §B is precisely that
tool's conversion; the remaining five attempts are unchanged
and the edited suite passes at baseline (23/23) and after.
Every other pre-existing suite is unedited; the full unit
suite and `npm run check` are green on the final tree
(counts in the PR body).

## Budget

Everyday catalog 19,999 tokens against the unchanged 20,000
cap — net zero: the save's description drops its TEST-only
claim for either-mode wording of identical token length
(14 tokens by the repo tokenizer, fitted inside the tool's
own description only, per the standing rule). No other
description was touched; the cap did not move.

## CAP-5 obligation

Live proof joins the CAP-5 queue: the `workflow_dispute_kit_
save` LIVE row — a real LIVE dispute the owner elects to
answer, staged (never submitted) through the converted save
on the owner's LIVE connection after a checked release,
including the app-supplied form with its recorded agreement
gap. With §B, D-8 is complete: every workflow composite,
read and write, follows the connection mode.
