# OWNER-OBEDIENCE-V2-DISPUTES — LIVE dispute evidence and acceptance confirmed-action conversion

Status: **SOURCE-IMPLEMENTED.** Family 2 of 13 of conformance
row 17, conversion **V2** (appendix mechanism 28). This is
corrective work inside the already-merged dispute choreography
(G-2c/G-2d1/G-2d2); it completes no predefined batch subsection
and must not be counted as one.
Baseline: `main` `abe16205d39ccc39cb3a476f899f84ab77777c1c`
(after PRs #303, #304, #305, #306, #307). Design draft:
`~/workspace/stripe-v2-design/card-disputes.md`; census:
`~/workspace/stripe-v2-design/census.md` Family 2.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The mode-aware replacement of `client(ctx)` in `src/tools/billing-shared.js` is shared with Families 4 and 5 and lands in whichever builds first | It already landed in PR #304 (OWNER-OBEDIENCE-V2-SHARED): `client(ctx)` delegates to `modeClient` in `src/tools/account-mode.js` | No seam work in this card; all three handlers already resolve their provider client mode-awarely |
| Dispatcher admission needs converting | Area `disputes` is already in `guardedLiveAreas` (`src/core/profiles.js:27` at this baseline) | No `profiles.js` change; `tests/unit/profiles.test.js` run unchanged to prove admission was already correct |
| The TEST-baked invariants are the ones the census enumerates (submit/accept dispute + charge, accept read-back) | Three more exist: the staged-evidence **file** mode refusal in `dispute-submit.js` preflight (`file.livemode===true`), and the draft's charge and file refusals (`payment.livemode===true`, `f.livemode===true`) in `dispute-evidence-draft.js` | All mode-parameterized to equality with the connection's mode, exactly like the enumerated ones; none deleted |
| `dispute-money-target` is a unit suite | It lives in `tests/db/dispute-money-target.test.js` and exercises the SQL approval binding with its own literal inputs | Untouched; its proof route is exact-head CI (no local PostgreSQL binaries on this machine). The handler's money description is mode-parameterized with the TEST wording byte-identical, so the proven TEST binding is unaffected |
| The three suites' handler-level LIVE expectations encode the wrapper gates | They assert refusal outcomes for a bare LIVE connection; after conversion the same outcomes are produced by the LIVE-enablement guard (`authorizeLiveWrite`: non-production deployment / account not independently enabled and connected) | Assertions unchanged — the refusal still fires, now for the correct reason; enabled-LIVE behavior is proven by the new LIVE fixtures |
| The dispute pipeline is only the three native tools | `workflow_dispute_kit_save` (workflows area) delegates to the native draft handler and still labels its own record `mode:'test'` (`src/tools/workflow-dispute-kit.js`) | Out of this family's scope and untouched; the native handler it delegates to now follows the connection mode when called directly. Recorded here as drift for the composite work, not built |
| A preview → approve → confirm sequence can mix argument sets | `previewFingerprint` is part of the idempotency payload (not in `src/stripe/client.js`'s OMIT set), so the money approval binds to the exact argument set that presented it | Test-fixture fact, already the Money family's LIVE treatment: the accept LIVE tests use one consistent argument set for request, approval and execution. No code change resulted |

## Build contract, as built

- `src/tools/dispute-submit.js`: the handler wrapper gate is
  gone. `checkArgs` strips the core `previewFingerprint` control
  field before validation (the schema declares it, per the V2
  shared card's ruling 5 — uniform across modes). Every mode
  invariant now demands equality with the connection's mode in
  both directions: the dispute, its charge, each staged evidence
  file, and the read-back in `verify`. The preview summary is
  mode-labeled (`LIVE MODE` / `TEST ONLY`) and, in both modes,
  states the disputed amount and deadline Stripe reports and
  discloses in plain words that submitting sends the evidence to
  the issuing bank and, once submitted, it cannot be edited or
  withdrawn. Tool description de-TESTed.
- `src/tools/dispute-accept.js`: the handler wrapper gate is
  gone. Preflight strips `previewFingerprint` the same way; the
  dispute, charge and read-back `livemode` invariants are
  mode-parameterized. The summary is mode-labeled and now
  discloses that accepting concedes the full disputed amount
  plus Stripe's dispute fee, which is not returned; the money
  spec's description is mode-parameterized with the TEST wording
  byte-identical. **The money spec amounts and the
  `defineWrite` money wiring are untouched** — rows 20–21 stay
  wired exactly as before, and no new money path is created:
  acceptance still moves money only through the existing
  reservation, exact owner approval and daily cap. Tool
  description de-TESTed.
- `src/tools/dispute-evidence-draft.js`: the handler wrapper
  gate is gone. `validate` strips `previewFingerprint` (local
  name `clean`; `fields` is this module's evidence-field list).
  The target dispute, its charge and each staged file demand the
  connection's mode; the read-back in `verify` does the same.
  The summary is mode-labeled and states the draft can be
  revised until the evidence is submitted; drafts still save
  with explicit `submit:false` and remain freely revisable until
  Family-2 submission. Tool description de-TESTed.
- Reused, not rebuilt: the `defineWrite` lifecycle (fresh read,
  app-ownership target guard, preview, `confirm`, `rmcp_`
  idempotency, `recordChange` journal, `verify` read-back), the
  shared preview-fingerprint binding in `src/core/write.js`
  (a drifted confirmation refuses with the fresh preview and
  fingerprint disclosed and executes nothing), and
  `authorizeLiveWrite` as the LIVE-enablement guard.
- Aim checks preserved verbatim: dispute/charge identity and
  state proofs (exact IDs, open dispute, USD, positive verified
  loss for accept, the accept amount ceiling); evidence field
  and content validation (row 45); rows 20–21 for accept.

## Named tests

- `tests/unit/dispute-submit.test.js` — existing 7 tests
  unchanged; **+3 LIVE tests**: the preview discloses finality,
  the disputed amount and the deadline and carries a
  `WRITE-…` fingerprint, and the confirmation submits exactly
  once against `livemode===true` dispute/charge/file fixtures
  (through the exported handler); a drifted confirmation
  refuses with the fresh fingerprint disclosed and executes
  nothing; wrong-mode provider objects refuse in both
  directions. The private-evidence sentinel still never appears
  in any result or audit row.
- `tests/unit/dispute-evidence-draft.test.js` — existing 6
  tests unchanged; **+2 LIVE tests**: preview then save a
  revisable LIVE draft with `submit:false` through the exported
  handler (fingerprint-bound); wrong-mode objects refuse in
  both directions.
- `tests/unit/dispute-accept.test.js` — existing 8 tests
  unchanged, including the seven-case money-out contract, the
  shared-cap override case and the money-gate regression
  (no approval → no acceptance); **+3 LIVE tests**: the preview
  discloses the concession with amount and fee wording and a
  fingerprint, and confirm alone never closes (usage stays 0);
  an owner approval granted through the decision-intent path
  (the owner page's route; `approveMoneyRequest` remains the
  TEST-only direct route) closes exactly once and counts 8500
  against the day; a drifted confirmation and a wrong-mode
  dispute both refuse and nothing closes.
- `tests/unit/profiles.test.js`,
  `tests/unit/money-owner-approval.test.js`: run with unchanged
  expectations, all passing — dispatcher admission was already
  correct and accept's approval gates are unrelaxed.
- `tests/db/dispute-money-target.test.js`: unchanged; database
  proof is exact-head CI's route on this machine.
- Full unit suite and `npm run check` on the assembled tree.

## Done when

Met in source: all three operations run the full
confirmed-action sequence on synthetic LIVE fixtures in tests,
with accept's money gates demonstrably unrelaxed (the
pre-existing refusal suites pass with unchanged expectations,
and the new LIVE tests prove no-approval, drift and wrong-mode
refusals). Docs updated (TOOL-CATALOG dispute rows,
conformance row 17 V2 progress note, COMPLETION, STATUS).
**Live proof remains open** (CAP-5 queue): a real LIVE dispute
submission or acceptance happens only when a real dispute
exists and the owner elects to act on it; this family's proof
is source/synthetic until then. No account was enabled, no
LIVE key was used, and no real money moved.
