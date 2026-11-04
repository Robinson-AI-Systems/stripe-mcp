# OWNER-OBEDIENCE-V2-PROJECTS — LIVE projects provider-write half conversion (ruling 4 split)

Status: **SOURCE-IMPLEMENTED.** Family 13 of 13 of conformance
row 17, conversion **V2** (appendix mechanism 28) — the last
family in the frozen sequence. This is corrective work at the
boundary of the already-merged project-profile choreography
(P-1/P-2/P-3/P-4); it completes no predefined batch subsection
and must not be counted as one.
Baseline: `main` `9c5a865f19ce53e62db926a03028aacff818515b`
(after PR #317, Reports); rebased onto `3fb998cd` (PR #318,
Branding) before landing. Design draft:
`~/workspace/stripe-v2-design/card-projects.md`; census:
`~/workspace/stripe-v2-design/census.md` Family 13; scope:
coordinator ruling 4 (`~/workspace/stripe-v2-design/coordinator-rulings.md`).

## The ruling-4 split, as built

The family's five operations are not one kind of thing, and the
coordinator ruled the split on 2026-11-03:

- **Provider-write half — CONVERTED here.**
  `project_portal_create` (creates a real billing-portal
  configuration at Stripe), `workflow_project_setup` (guided
  steps that create or verify provider objects), and
  `workflow_app_readiness_fix` (applies a readiness remediation
  through composed native writes).
- **Binding half — NOT converted, referred.**
  `project_bind_profile_account` and
  `project_enable_scoped_ownership` change *server-side* binding
  state (which app profile governs an account; whether scoped
  ownership is enabled) and create nothing at Stripe. They are
  referred to the **owner-surface migration** that
  `src/tools/app-profiles.js:94` already anticipates ("App
  ownership guard remains in legacy safety mode until separate
  owner migration") — the setup page's confirmed-intent machinery
  (appendix row 10), not the write-conversion pattern. That is
  their recorded future home; they are not dropped.
  `src/tools/app-profiles.js` is **byte-untouched** by this
  card, and the :94 note stays in place deliberately: it remains
  accurate (the migration has not happened), it is named here so
  it is not silently left, and re-dating or resolving it belongs
  to the migration's own PR — touching the module in this PR
  would break the byte-identical refusal proof below.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The design card builds the whole family (its draft is written for ruling (a)) | The coordinator ruled (b) on 2026-11-03: provider-write half in V2, binding half referred to the owner-surface migration | Built under (b). The card's (a) build contract is followed for the provider half only; its binding-half contract (mode-aware `accountOk`, gates at app-profiles.js:162/164 removed) is **not** executed and is recorded as referred |
| Dispatcher admission = add the `projects` area to both guarded sets (design card, ruling (a)) | Under (b) that would also admit the two binding tools — they are area `projects`, `defineWrite-v1`, full-profile — widening exactly what ruling 4 forbids | Admission is an **exact name set** instead (`guardedProjectProviderWrites` in `src/core/profiles.js`), consulted by both `isGuardedTestWrite` and `isGuardedLiveWrite`. The area stays out of both area sets; the three names are the whole delta, proven against the registry in the new suite |
| The design card's baseline predates the shared machinery | Baseline at build already carries PR #304 (fingerprint binding + `modeClient` seam) and eleven merged families | No seam work in this card; `client()` from `billing-shared.js` already resolves mode-awarely, and the core lifecycle already binds confirmations to preview fingerprints (ruling 5) |
| Family numbering | The census and design card count this family **13 of 13**; the frozen build sequence lands it twelfth because family 10 in census order (customer monetary) was withdrawn from V2 by ruling 3 | Repo records (STATUS, conformance, COMPLETION) use the census numbering — family 13 of 13 — as the predecessor cards do (see the Reports card's numbering note); this card follows them |
| The account proof is a TEST-only helper (`readVerifiedTestAccount`) shared by all three provider modules | The same module (`src/stripe/test-account.js`) already exports `readVerifiedLiveAccount` — the independent LIVE account + balance proof the account-mode seam uses — and the readiness module's portal/webhook projections are already mode-shaped (`safePortal` in project-setup was local; `webhookSafe` already takes a mode) | Each provider module dispatches on the connection's mode to the matching proof/projection. `app-profiles.js`'s own use of the TEST proof is untouched, so the binding half's verification behavior cannot move |
| Mode-parameterizing the readiness state helper (design card: `workflow-app-readiness.js:147`) is a write-side change only | `readiness()` is also the **read** tool's whole implementation: parameterizing it alone would silently widen `workflow_app_readiness` to LIVE connections — read reachability that belongs to CAP-4, not to this family's write conversion | Observations are mode-parameterized inside `readiness()` (the fix's internal `read`/`readAfter` call it directly), and the **read handler keeps its own TEST-only refusal with the identical message** (`Select an enrolled TEST account`). Read reachability is byte-identical; the `mode:'live'` sentinel report on a TEST connection is unchanged, and `workflow_go_live_checklist` (which composes the read handler on TEST connections) is unaffected |
| `previewFingerprint` needs no family work (the core schema declares it) | All three provider writes validate argument keys locally and would have refused a confirmation presenting the fingerprint | The control field is admitted in each local validator (`project-setup.js` portal + setup reads, `verifiedInput` in the readiness fix) and declared in each tool schema — the merged families' idiom under ruling 5 |
| Setup's brand step composes a still-gated native write | True at the build baseline; Branding (PR #318) merged during this build and the branch was rebased onto it, so on the final tree `brand_save_kit` is itself converted | Either way the composition rule holds: setup steps dispatch through the guarded native surface and inherit each child's own guards — a still-gated child refuses at that step with its family's refusal, never a bypass (the card's contract). The step now also reads the existing brand kit in the **connection's** mode (was hard-coded `mode:'test'`) |
| `normalizedSetup`'s ID-shape messages ("Select exact existing TEST Portal configuration") are mode checks | The `bpc_`/`pmc_` shapes they validate are mode-neutral; only the wording named TEST | Wording mode-neutralized in `src/projects/setup.js`; the validation behavior is unchanged and no test asserted the old strings |
| The setup result's `liveEnabled:false` is a mode statement | `summarizePlan`'s `profileStatus`/`accountBound`/`liveEnabled` describe the **recorded draft profile's binding state**, not the connection mode: a completed setup in either mode ends with an unbound draft and legacy guard scope | Unchanged, and the disclosure now says so in words (setup preview: the draft is not bound, scoped ownership is not enabled). The new LIVE suite proves a completed LIVE setup still ends unbound with scope `legacy` |
| The readiness report's `liveProviderQueried` is a constant | It was hard-coded `false` in the observation return (correct for a TEST connection: LIVE was not queried). On a LIVE connection the observation *does* query the live provider | The observation return now reports `liveProviderQueried` honestly from the connection mode; TEST output is byte-identical |

## Build contract, as built

- `src/core/profiles.js`: **the entire dispatcher delta is
  one exact name set** — `guardedProjectProviderWrites` =
  `project_portal_create`, `workflow_project_setup`,
  `workflow_app_readiness_fix` — consulted by
  `isGuardedTestWrite` and `isGuardedLiveWrite` for
  area-`projects` tools. The `projects` area is deliberately
  **not** added to `guardedTestAreas`/`guardedLiveAreas`.
  Consequences, all proven against the real registry: the three
  provider writes are admitted in TEST for their built profiles
  (full only; never `read_only`) — TEST reachability is itself
  new, the Families 4/9 both-modes situation — and in LIVE only
  on the owner-approved connection; the two binding tools are
  admitted in **neither** mode and appear in **neither** the
  TEST nor the LIVE catalog listing. No other area's admission
  changes; rows 20–21 are untouched; no project tool is a money
  tool.
- `src/tools/app-profiles.js`: **not modified.** The binding
  half's handlers, its `accountOk` TEST gate, its revision
  binding (row 43 — the family's fingerprint, unchanged) and
  its three reads keep exactly today's behavior in both modes.
- `src/tools/project-setup.js`: both handler TEST gates are
  gone (`project_portal_create`'s wrapper refusal and the setup
  handler's mode refusal). `verified()` proves the selected
  account in the connection's own mode (`readVerifiedTestAccount`
  in TEST, `readVerifiedLiveAccount` in LIVE; the historical
  refusal text covers every other mode). `safePortal` demands
  the configuration's `livemode` equal the connection's mode in
  creation response, read-back and verify, both directions.
  The setup brand step reads the existing kit in the
  connection's mode; the composed webhook child's description is
  mode-labeled. Previews are mode-labeled: the LIVE portal
  preview states the configuration is created on the LIVE
  account where real customers can use it **and** that no app
  profile is bound and no app policy is activated; the LIVE
  setup preview enumerates the step sequence and states the
  provider objects are created or verified on the LIVE account
  while the setup records a draft only — **it does not bind the
  profile to the account and does not enable scoped
  ownership**. TEST preview texts are byte-identical.
  Descriptions de-TESTed.
- `src/tools/workflow-app-readiness.js`: the fix's handler
  TEST gate is gone. `readiness()` observations are
  mode-parameterized: the verified account read dispatches by
  mode; `safePortal` takes the connection's mode (its exported
  default stays TEST for existing callers); the webhook
  projection and the webhook `livemode` check demand the
  connection's mode; Dashboard links use the connection mode's
  base; the observed rows' mode-bearing notes (account read,
  hosted Checkout, payment/portal/webhook selection) are
  mode-labeled with TEST wording byte-identical; the report's
  `mode` field reports the connection's mode. The fix's
  composed native writes (`account_update_payment_method_settings`,
  `portal_update_configuration`, `webhook_add_events`) keep
  their own families' guards — a still-gated child refuses at
  that step with its family's refusal. The fix preview is
  mode-labeled. **The `workflow_app_readiness` read handler is
  unchanged in reachability** (see drift): it refuses non-TEST
  connections with the identical message, and its
  `mode:'live'` sentinel report is untouched.
- `src/projects/setup.js`: two ID-shape validation messages
  mode-neutralized (drift table); no behavior change.
- Reused, not rebuilt: the `defineWrite` lifecycle (fresh read,
  app-ownership target guard — row 30, setup steps that evaluate
  bound profiles read existing binding state but record none —
  preview, `confirm`, `rmcp_` idempotency, `recordChange`
  journal, `verify` read-back), the shared preview-fingerprint
  binding in `src/core/write.js`, `authorizeLiveWrite` as the
  LIVE-enablement guard, `modeClient` for provider resolution,
  and row 43's revision binding in the (untouched) binding
  module.
- Aim checks preserved verbatim: the portal four-choice policy
  requirement (never grant cancellation/plan switching by
  default); the setup run's durable step reservation, digest
  binding and no-replay-of-uncertain-steps rules; the readiness
  fix's eligible-repair proof (a row must be observed `missing`
  with a repair plan in the connection's mode before any child
  runs); the app-ownership guard wherever setup steps touch
  provider records. **The money wiring is untouched:
  `src/tools/write.js`, `src/money.js` and `src/db.js` are
  byte-untouched by this card (verifiable in the diff), and no
  project write moves money.**

## Named tests

- `tests/unit/projects-live-conversion.test.js` — **new, 16
  tests.** Dispatcher admission: the registry carries exactly
  the five family writes; the three provider writes admitted in
  TEST (full, never `read_only`) and in LIVE only on the
  owner-approved connection; **the binding half gains no
  admission in either mode and appears in neither catalog
  listing**. Binding-half regression proof: on a LIVE
  connection both binding handlers return exactly today's
  refusals (`TEST app-account binding only` / `TEST scope
  migration only`) and change no state (profile version and
  guard scope unmoved), and the TEST bind still completes with
  scope left `legacy`. Portal: LIVE preview discloses the
  real-customer effect and the no-binding fact; fingerprint-
  bound confirm creates exactly once with an `rmcp_` key; a
  fabricated fingerprint refuses with zero creates; a
  TEST-issued fingerprint does not confirm in LIVE (mode is
  bound in the digest); wrong-mode creation responses are
  unconfirmed in both directions; a bare LIVE connection is
  refused by the LIVE-enablement guard before any write.
  Setup: LIVE preview names the step and what is/is not bound;
  the portal and draft steps complete into an **unbound** draft
  (profile `stripe_accounts` empty, guard scope still
  `legacy`); a wrong-mode child read-back leaves the step
  unconfirmed. Readiness fix: LIVE preview is mode-labeled;
  fingerprint-bound confirm applies exactly one webhook event
  union (7 events); wrong-mode webhook objects refuse in both
  directions with zero provider writes; a bare LIVE connection
  is refused before any write; **the readiness read still
  refuses a LIVE connection with the identical message** and
  its TEST-connection `mode:'live'` sentinel is unchanged.
- `tests/unit/profiles.test.js` — one added block asserting
  the same admission split against the real registry (the
  design card's named admission test). No existing expectation
  in the file changes.
- `tests/unit/project-setup.test.js`,
  `tests/unit/app-profiles.test.js`,
  `tests/unit/workflow-app-readiness.test.js`,
  `tests/unit/setup-readiness-report.test.js` — run with
  **unchanged expectations**, all passing: every pre-existing
  refusal still fires, including both bare-LIVE cases, now
  refused by the LIVE-enablement guard / verified-account proof
  (the converted families' precedent), and the binding suite's
  LIVE refusal — produced, as before, by the untouched module.
- Database suites: unchanged; database proof is exact-head
  CI's route on this machine (no local PostgreSQL binaries,
  per `session:prepare`).
- Full unit suite and `npm run check` on the assembled tree
  (see Done when).

## Done when

Met in source: the three provider-write operations are
admitted in both modes and run the full confirmed-action
sequence on synthetic fixtures — end to end in TEST
(reachability itself new) and in LIVE on the owner's own
connection — with the binding half demonstrably unmoved (no
dispatcher admission in either mode, module byte-untouched,
LIVE refusals and TEST completion proven identical) and every
pre-existing refusal still firing. Full unit suite on the
final rebased tree: **198 files, 2,046 tests, all passed**;
`npm run check` exit 0; conflict-marker grep empty (run after
the rebase); `git diff --check` clean. Docs updated (this
card, TOOL-CATALOG project rows for the three converted
writes, conformance row 17 V2 progress note, COMPLETION,
STATUS). No DECISIONS entry was needed — the scope decision
is coordinator ruling 4 (2026-11-03), already recorded; no
new decision arose. With this family the **V2 family sequence
is complete in source**: all twelve buildable families are
source-implemented. **Live proof remains open** (CAP-5
queue): a real LIVE portal creation, setup step or readiness
fix happens only when the owner elects to act on a real
account, and the binding half closes only through the
owner-surface migration plus its own live proof; this
family's proof is source/synthetic until then. No account
was enabled, no LIVE key was used, and no real money moved.
