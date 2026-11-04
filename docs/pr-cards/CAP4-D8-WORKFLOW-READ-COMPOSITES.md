# CAP4-D8-WORKFLOW-READ-COMPOSITES — §A: the workflow read composites follow the connection mode

Status: **SOURCE-IMPLEMENTED.** Family D-8 §A of CAP-4 (the tenth
CAP-4 family built, in the frozen Phase 1 sequence after D-12).
Frozen claim: `card-workflow-read-composites.md` §A in the
coordinator's design folder, plus coordinator ruling 2 (the
`workflow_dispute_kit_save` conversion is §B, a separate sibling
unit — not built here). Baseline: `main`
`2688228fe8593ac7db36f7b43bfb94142d54eb9d` (PR #331, CAP-4 D-12).
Read paths only: all nine composites stay `writes: false`, no
composite gains a write, 0 new operations are claimed (every
composed operation belongs to its owning D-card, all merged), and
the money wiring (`src/tools/write.js`, `src/money.js`,
`src/db.js`) is byte-untouched, proven by an empty name-only diff
against the baseline.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The card's nine census names are the registered read composites | Four names are drift (`workflow_customer_summary`, `workflow_billing_overview`, `workflow_go_live_check`, `workflow_revenue_recovery_plan`); two (`workflow_onboarding_checklist`, `workflow_subscription_surgery_plan`) have no registered read counterpart; the registry's nine `writes: false` workflow tools are the family | Converted the nine registered reads; drift table in this card; scope unchanged |
| §A's operations are claimed by their owning D-cards, all merged | Confirmed at the shipped baseline: every composed native read used by the nine (D-1…D-7, D-11, D-12, Connect reads) is mode-converted | 0 new operations claimed |
| `verifyContext` can be made mode-aware in place | Every write entry funnels through `writable()`, which calls `verifyContext` before any composed read; an in-place change would alter write admission | Split route: `verifyContext` byte-identical; new `verifyModeContext` + opt-in `{verify}` plumbing with legacy defaults |
| Stored month-close/go-live records carry `mode: 'test'` stamps to preserve | No local stored workflow records exist at this baseline (`src/db.js` has no such state); the stamps live on composed result records, and provider report runs are D-6-partitioned | Stamp inventory in this card; close verifies the composed snapshot's stamp against the connection mode; no re-stamping anywhere |
| `workflow_go_live_check`'s LIVE-parity read means the composite is nearly LIVE-ready | The parity read is the no-query sentinel; the first read must return the TEST matrix, which a LIVE connection cannot produce (no cross-mode reads) | Internal contract preserved; LIVE degrades honestly (per-app gap or the matrix refusal), both pinned |
| `workflow_app_readiness`'s gate is the only readiness change needed | `readiness()` is already mode-parameterized (V2 family 13); `input()` and one internal validation text are shared with the fix WRITE's observation path | Exactly the read handler's gate converted and the CAP-4 comment discharged; shared texts examined and left |

## Scope, as built

The registry holds exactly nine `writes: false` workflow tools,
and they are the family: `workflow_customer_overview` and
`workflow_failed_payments` (`src/tools/workflow-customers.js`),
`workflow_money_snapshot` (`src/tools/workflow-money-snapshot.js`),
`workflow_month_end_close` and `workflow_find`
(`src/tools/workflow-month-close-find.js`), `workflow_dispute_kit`
(`src/tools/workflow-dispute-kit.js`), `workflow_webhook_health`
(`src/tools/workflow-webhook-health.js`),
`workflow_go_live_checklist` (`src/tools/workflow-go-live.js`), and
`workflow_app_readiness` (`src/tools/workflow-app-readiness.js`),
over the shared plumbing in `src/tools/workflow-read-common.js`.
Each now verifies its context account in the connection's own mode
and composes the already-converted native reads (D-1…D-7, D-11,
D-12) in that mode; a wrong-mode object anywhere in a composition
fails or honestly incompletes the composite, per its baseline
partial semantics.

## Census drift (recorded, scope unchanged)

The frozen card and census name nine composites; four census
names are not registry names, and two census names have no
registered read counterpart:

| Census name | Registered tool |
| --- | --- |
| `workflow_customer_summary` | `workflow_customer_overview` |
| `workflow_billing_overview` | `workflow_money_snapshot` |
| `workflow_month_end_close` | `workflow_month_end_close` |
| `workflow_go_live_check` | `workflow_go_live_checklist` |
| `workflow_revenue_recovery_plan` | `workflow_failed_payments` |
| `workflow_dispute_kit` | `workflow_dispute_kit` |
| `workflow_app_readiness` | `workflow_app_readiness` |
| `workflow_onboarding_checklist` | — no registered read tool |
| `workflow_subscription_surgery_plan` | — no registered read tool (`workflow_change_plan` is a `writes: true` write composite, preserved untouched) |

The remaining two family members the census list omits,
`workflow_find` and `workflow_webhook_health`, are registered
reads in the same modules and convert with the family.

## The preservation clause — SPLIT route, with proof

The frozen card's central hazard: `verifyContext` in
`workflow-read-common.js` is shared. Making it mode-aware in place
would alter write admission, so the split route the card names is
taken:

- `verifyContext` is **byte-identical** to baseline (TEST-only,
  refusal text `An exact selected TEST account and permitted read
  profile are required`).
- A new `verifyModeContext(ctx)` sits beside it: it admits an exact
  selected account with a permitted profile in either mode, with
  the refusal's mode word substituted from the connection, so a
  TEST connection sees byte-identical text.
- `nativeRead`/`collect` gain an opt-in `{verify}` option that
  defaults to `verifyContext`. Only the read composites pass
  `verifyModeContext`. `statusText`'s denial text gains the
  connection's mode word through the same plumbing (TEST output
  byte-identical).

Proof that no write path moved: **every** write entry funnels
through `writable()` (`src/tools/workflow-customer-actions.js`),
which calls `verifyContext` before any `nativeRead`/`collect`
use — refund/cancel (`run`), brand-business (`run`;
`desiredStage` also calls `verifyContext` directly),
catalog-setup, change-plan, month-end report (`report`),
dispute-kit save (`save`, then the shared `examine`), and
webhook fix (`fix`, then the shared `source`). The two shared
read phases inside write-owned modules — dispute-kit's
`examine()` and webhook-health's `source()` — are parameterized
with legacy defaults, and their write callers pass nothing, so
the save and fix paths execute the identical legacy verifier,
validation wording and stamps as at baseline. The new suite pins
all six write composites (`workflow_refund_customer`,
`workflow_brand_business`, `workflow_set_up_catalog`,
`workflow_month_end_report`, `workflow_dispute_kit_save`,
`workflow_webhook_health_fix`) refusing a LIVE context with the
exact baseline gate text, and both write composites' own suites
pass unchanged. `workflow-read-common.js` is the only shared file
edited, and its write-facing exports keep legacy defaults.

## Per-composite conversion

- **workflow_customer_overview / workflow_failed_payments**
  (customers): entry gate, scope validation, and all collects take
  the mode-aware verifier; the result stamps and the
  decline-reason/explanation mode words follow the connection
  (TEST byte-identical). A wrong-mode composed object incompletes
  the list composites and refuses the overview's verified
  customer read.
- **workflow_money_snapshot**: entry gate and both collects
  (plus `fullItems`' item pages) take the mode-aware verifier;
  the stamp and the explanation's mode word follow the
  connection. Its `mode` stamp is the record
  `workflow_month_end_close` reads back (below).
- **workflow_month_end_close**: entry gate and its three composed
  reads (the money snapshot, `report_get_run`,
  `report_get_result_file`) take the mode-aware verifier; the
  snapshot consistency check compares against the **connection**
  mode; the stamp follows the connection. The sibling WRITE
  `workflow_month_end_report` in the same module is untouched
  (its own `writable()` gate, default-verifier composed reads,
  and its `mode: 'test'` result stamp all stand).
- **workflow_find**: entry gate and the composed search reads
  take the mode-aware verifier; the stamp follows the connection;
  a wrong-mode search page degrades to the baseline
  `provider_search_unavailable` incompletion.
- **workflow_dispute_kit** (read): the handler passes the
  mode-aware verifier and mode word into the shared `examine()`;
  §B's save calls `examine()` with defaults (see the preservation
  clause). The stamp follows the connection. One honest LIVE
  behavior: the app-agreement link composes `project_record_link`,
  a Projects read that stays TEST-gated until the owner-surface
  migration (coordinator ruling 4), so on LIVE the kit records
  the baseline gap (`app_agreement_link` /
  `guarded_profile_route_unavailable`) and puts the agreement on
  the checklist rather than fabricating it. The §B sibling
  (`workflow_dispute_kit_save`) is **not** converted in this build.
- **workflow_webhook_health** (read): the handler passes the
  mode-aware verifier and mode word into the shared `source()`;
  the fix calls `source()` with defaults. The stamp follows the
  connection, and the closing note follows it too (TEST keeps the
  baseline `No LIVE endpoint was queried or altered…` text; LIVE
  states the selected LIVE endpoint was queried read-only and
  nothing was altered). Destination paths and signing secrets
  stay redacted in both modes.
- **workflow_go_live_checklist**: the context gate follows the
  connection (entry verifier, validation and binding texts take
  the mode word); the stamp follows the connection. The internal
  contract is the tool's subject and is preserved exactly: the
  first per-project read must return the **TEST** readiness
  matrix and the second is the `mode: 'live'` sentinel
  (parity-read pattern, named in tests). Cross-mode reads do not
  exist, so from a LIVE connection the composite can never
  fabricate its matrix: when the readiness read itself is
  unavailable it degrades per app to a
  `protected_test_read_unavailable` gap (`complete: false`,
  `projects: []`); when the LIVE readiness read succeeds against
  real LIVE data, the matrix check refuses with `Complete
  selected TEST readiness matrix unavailable`. Both outcomes are
  pinned. Texts that name the TEST matrix and the TEST catalog
  candidates are kept verbatim — they describe the matrix and
  the deferred copy plan, which are TEST subjects in both modes.
- **workflow_app_readiness**: exactly the READ handler's gate is
  converted, per the frozen card: the handler's TEST-only mode
  check is removed, the in-code comment assigning read
  reachability to CAP-4 is replaced with the discharge note, and
  the `readiness()` internal comment records the same discharge.
  The handler now consumes the already mode-parameterized
  observations (V2 family 13): on TEST the observation output is
  unchanged; on LIVE it runs full LIVE observations
  (`liveProviderQueried: true`); the `mode: 'live'` argument
  still selects the no-query sentinel. `input()`'s and
  `readiness()`'s internal `Select an enrolled TEST account`
  texts are examined and left: both are shared with the
  readiness_fix WRITE's observation path, which is not this
  card's to move. The Projects WRITE side (profile binding,
  scoped ownership) is untouched.

## Stored-state and stamp inventory

At this baseline the composites persist **no local stored
records** (no workflow month-close/go-live state exists in
`src/db.js`); the frozen card's stored-state language maps to
the composed result records, inventoried here. Every
`mode: 'test'` result stamp in a read path now stamps the
connection's mode: failed payments, customer overview, money
snapshot, month-end close, find, dispute-kit examine, webhook
source, go-live checklist. The two remaining `mode: 'test'`
stamps in these modules belong to WRITE results (month-end
report, webhook fix) and stand untouched. No code re-stamps any
existing record. The one cross-composite record read —
month-end close reading the money snapshot — verifies the
snapshot's stamp against the connection mode (baseline compared
against the literal `'test'`), so a snapshot is only ever
consumed in its own mode. Provider-side report runs keep the
D-6 mode partitioning: a TEST-stamped run read under a LIVE
connection is refused by the verified read, never silently
served or re-stamped, pinned in the new suite.

## Examined and left (recorded, not converted)

- Month-end close's `!report` next-action text names native TEST
  report types: `workflow_month_end_report` is genuinely
  TEST-only, so the text truthfully names a TEST artifact in both
  modes (the D-12 dashboard-map precedent).
- Go-live's matrix and catalog-candidate texts (above).
- Readiness `input()` / internal validation texts (above).
- Webhook `fix`'s own result stamp and its TEST warning texts:
  the fix is a write; untouched.

## Tests

New suite `tests/unit/cap4-d8-workflow-read-composites.test.js`
(23 tests): helper unit tests (legacy `verifyContext` contract
byte-exact; `verifyModeContext` both modes and mode-word
refusals; `nativeRead` default = legacy verifier, opt-in =
mode-aware); each composite in TEST and LIVE fixtures end-to-end
with composed reads verifying in the connection mode; a
wrong-mode object case per composite where the composition
supports one (overview refuses, failed payments / snapshot /
find incomplete, dispute kit and webhook health refuse, close's
stored report run partitioned); stamp tests (snapshot and close
stamp per connection, TEST outputs byte-identical); the go-live
parity pattern and both LIVE outcomes; readiness handler both
modes with the sentinel pattern preserved; the six write
preservation pins; the nine descriptions.

**Honest baseline accounting.** Run against a pristine baseline
checkout (`2688228f`) with only the test files added, the new
suite fails 16 of 23 and passes 7. The 7 baseline passes are by
design: the legacy `verifyContext` contract pin, the TEST
customers end-to-end test, the stored-report-run test (its TEST
leg is baseline behavior and its LIVE leg errors at the baseline
gate too — outcome-identical, mechanism converted), the
webhook wrong-mode refusal (baseline gate also errors), the
write-consumer preservation pins (they pin baseline behavior —
that is their purpose), the shared-read-phase defaults test, and
the TEST go-live matrix/sentinel test. The 16 failures are the
conversion's substance (every LIVE leg, the mode-aware helper,
the descriptions).

Five pre-existing suites carried LIVE legs that pinned the
abolished gate on read composites; per the D-7 precedent those
legs are updated to the post-conversion contract with **no TEST
assertion changed**: `workflow-customers.test.js` (LIVE failed
payments now returns an honest incomplete LIVE result with zero
provider calls; the overview still errors),
`workflow-money-snapshot.test.js` (LIVE snapshot is an incomplete
scan before any provider call on a TEST fixture),
`workflow-finalization.test.js` (LIVE month-end close reports an
incomplete LIVE close; the catalog write still refuses; zero
provider calls stand),
`workflow-operator-completion.test.js` (LIVE go-live degrades per
app to the gap), and `projects-live-conversion.test.js` (the
readiness READ's TEST-only reachability pin — the exact gate the
frozen card names — becomes the served LIVE observation, with the
sentinel leg unchanged). All five legs fail at baseline and pass
after.

## Budget

Everyday catalog 19,999 tokens against the unchanged 20,000 cap:
the nine descriptions were refitted inside the family only
(142 → 144 tokens by the repo tokenizer; dual-mode wording plus
tightening), no other family's text touched, the cap unmoved.
`workflow_app_readiness`'s description names no mode and is
unchanged.

## CAP-5 obligation

Live proof stands in the CAP-5 queue: the LIVE composite rows —
customer summary (overview), billing overview (money snapshot),
month-end close, and readiness — plus failed payments, find,
dispute kit (with its agreement-link gap behavior), webhook
health, and the go-live checklist's honest LIVE outcomes, on the
owner's LIVE connection after a checked release.

## What was NOT done

- §B: `workflow_dispute_kit_save` is not converted; it remains
  the immediate sibling unit under coordinator ruling 2.
- No write composite, write handler, or money-wiring file was
  modified; the only shared-file edit (`workflow-read-common.js`)
  adds opt-in plumbing whose defaults are the legacy behavior.
- The Projects binding half (profile binding, scoped ownership,
  `project_record_link` and the other TEST-gated project reads)
  is untouched; it belongs to the owner-surface migration.
- No registry change: 329 tools, writes still 155.
