# OWNER-OBEDIENCE-V2-REPORTS — LIVE report runs confirmed-action conversion

Status: **SOURCE-IMPLEMENTED.** Family 10 of 13 of conformance
row 17, conversion **V2** (appendix mechanism: report runs).
This is corrective work inside the already-merged reporting
choreography (G-1d2); it completes no predefined batch
subsection and must not be counted as one.
Baseline: `main` `1449e8de356e7db0cd4f8b95e50003921f984527`
(after PRs #303–#315: V1, the V2 shared machinery, V4, Money,
Disputes, CI speed, Payments, Invoices & credit notes, Billing,
Checkout, Radar, Identity); rebased onto `d69573f7` (PR #316,
Files) before landing, with the shared-doc interleaves
(STATUS, conformance, COMPLETION) and the `guardedLiveAreas`
admission resolved by keeping both families' records — the
live set now carries `files` and `reports` side by side.
Design draft:
`~/workspace/stripe-v2-design/card-reports.md`; census:
`~/workspace/stripe-v2-design/census.md` Family 11; coordinator
rulings: `~/workspace/stripe-v2-design/coordinator-rulings.md`.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The design card's baseline is current | The card was drafted against `94813299` (pre-V2-shared); the shared machinery it names as future work (preview-fingerprint binding in `src/core/write.js`, the mode-aware client seam) has since landed in PR #304, and Families 1–8 have converted | Built on current `main`; the card's reuse list is satisfied by the merged machinery, not rebuilt |
| Family numbering | The design card and census call Reports "family 11 of 13": the census sequence counted the customer-monetary item as family 10, and that item was withdrawn from V2 by coordinator ruling 3 (row-35 engineering, its own card) | This card follows the merged cards' counting (Money 1 … Files 9, Reports 10, Branding 11, Projects 12, of the original 13); the census sequence position is unchanged |
| The named test files are `tests/unit/report-run-write.test.js` and `tests/mock/report-run-write-contract.test.js` | The suites live at the swapped paths: `tests/unit/report-run-write-contract.test.js` (the real-handler contract suite) and `tests/mock/report-run-write.test.js` (the pinned-SDK shape check) | Both run unchanged; conversion proof lives in the new `tests/unit/reports-live-conversion.test.js`, per the merged families' idiom |
| Report reads and runs convert together | The reads (`src/tools/report-reads.js`, `src/tools/report-result-file.js`) are TEST-gated too, but reads are the conformance record's unclassified item (1), owned by CAP-4 | This card converts the single write, `report_run`, only; the reads keep their own gates and behave byte-identically (their suites run unchanged), so the family is not half-claimed |
| The refusal is only the handler gate | Two layers, as the card says: area `reports` absent from `guardedLiveAreas`, and the handler gate in `src/tools/report-run-write.js` with `livemode===false` invariants in the report-type verification and the read-back verify | Both converted; no further mode gate was found in the module (the ID patterns are mode-neutral — `frr_` and the report-type pattern carry no `test`/`live` segment — and there is no TEST-hardcoded read or shared projection in this write path) |
| Fingerprint confirmation works once the handler gate is gone | The module validates arguments with the shared `validateFields` (billing-shared), which rejects any field outside the per-tool property set — `previewFingerprint` included — so a fingerprint confirmation would throw before reaching the core check (the Radar/Files species) | Family-local resolution (the Payments/Invoices/Radar/Files idiom): the module strips `previewFingerprint` from a shallow copy before validation, and the tool schema declares it |
| Mode-parameterizing the type check keeps every refusal wording | The historical combined check refused a wrong-mode (or modeless) report type with the module's "cannot be verified" message; the shared `assertAccountResourceMode` throws its own mode-mismatch refusal | The identity/window failures keep the module's message, mode-parameterized (`Selected LIVE report type …` in LIVE, byte-identical in TEST); a mode mismatch on the type now refuses with the shared mismatch message, as in the converted families' read paths. Both are pre-write refusals; no case that was refused is now accepted, in either direction |
| JIT cards are registered in `docs/pr-cards/work-index.json` | None of the merged V2 cards (SHARED, MONEY, DISPUTES, PAYMENTS, INVOICES, RADAR, FILES) is registered there; the index validator passes without them | This card follows that precedent; no index change |

## Build contract, as built

- `src/core/profiles.js`: **`reports` is added to
  `guardedLiveAreas`** — the dispatcher admission this family
  needed, for exactly the one write (`report_run`, area
  `reports`, profile `full` only, as built). TEST admission
  already existed and is unchanged. Without the owner-approved
  LIVE connection the LIVE admission still refuses, and
  `read_only` still refuses everything. The tool is not a
  money tool, so no funding term applies; rows 20–21 are
  untouched. The exact delta is proven against the real
  registry in the new suite: the area carries exactly one
  write tool, and the area's reads (`writes: false`) are not
  guarded writes in either mode.
- `src/tools/report-run-write.js`: the handler TEST gate is
  gone; the handler dispatches directly. Under a LIVE
  connection the guarded-write pipeline's existing rules
  decide: full profile, catalog listing, a live-enabled and
  live-connected account, owner-approved LIVE, and a binding
  preview fingerprint; a bare LIVE connection is refused by
  the LIVE-enablement guard before anything executes (the
  pre-existing contract suite's bare-LIVE case now refuses
  through that guard, with unchanged expectations).
  - The report-type verification keeps its exact-identity and
    data-available-window checks; the type's `livemode` must
    equal the connection's mode (`assertAccountResourceMode`,
    required — a present livemode that disagrees, or none,
    refuses), in both directions.
  - `apply` refuses a created run whose present `livemode`
    disagrees with the connection's mode (the Files
    created-object precedent), and the read-back `verify`
    demands the read-back run's mode equal the connection's
    mode, alongside the unchanged identity, report-type,
    interval and status checks.
  - Aim checks preserved exactly: the curated report-type
    allowlist (standard balance, payout reconciliation and
    fee types only), the positive interval of at most 366
    days, and the report-type availability verification
    against the account's own mode window. The result-file
    handling rules are untouched: the result carries the
    verified run ID and status only, `downloadUrl: null`, and
    guidance to the (still TEST-only, CAP-4-owned) read tools —
    no report contents, no file URL, no token surfaces in any
    preview, result or audit record, in either mode.
  - Disclosure: summaries are mode-labeled. In TEST the
    summary text is byte-identical to the historical preview.
    In LIVE it adds, in plain words, that the output is a
    financial report file whose contents are the account's
    real figures for the stated interval. Creation is not
    completion in either mode: the summary and the result
    report the run as requested/pending, never as a finished
    report (`reportCompleted` stays truthful).
- The one caller beyond the registry: `workflow_month_end_report`
  invokes the native `report_run` handler through its own
  TEST-gated choreography (its own mode checks and plan token
  are untouched). On a TEST connection the native handler's
  behavior — including the preview text its plan token digests —
  is byte-identical, so the workflow's reachability and
  behavior are unchanged; it gains no LIVE reachability from
  this conversion.
- Reused, not rebuilt: the `defineWrite` lifecycle (fresh
  read, app-ownership target guard, preview, `confirm`,
  `rmcp_` idempotency, `recordChange` journal, `verify`
  read-back), the shared preview-fingerprint binding in
  `src/core/write.js` (a drifted confirmation refuses with the
  fresh preview and fingerprint disclosed and executes
  nothing), `authorizeLiveWrite` as the LIVE-enablement guard,
  and `modeClient` via the shared `client()` seam for provider
  resolution.
- Money discipline: report writes move no money, and
  `src/tools/write.js`, `src/money.js` and `src/db.js` are
  byte-untouched by this card (verifiable in the diff).

## Named tests

- `tests/unit/reports-live-conversion.test.js` — **new, 7
  tests.** Dispatcher admission: the registry carries exactly
  one write in the `reports` area; `report_run` is admitted in
  LIVE only on the owner-approved full connection (not for
  `everyday`, not for `read_only`, not without owner
  approval), admitted in TEST for full as before, listed in
  the LIVE owner catalog, and the area's reads are guarded
  writes in neither mode. LIVE (owner connection, fake
  provider + fake database): preview → fingerprint → confirm
  creates exactly one `livemode === true` run and reports it
  pending with `reportCompleted: false` and no URL anywhere in
  the result; the preview discloses the type, the exact
  interval, the real-figures contents and that creation is
  not data readiness. A drifted confirmation (the type's
  data-available window moved between preview and confirm)
  refuses with the fresh fingerprint disclosed and zero
  provider writes, and the fresh fingerprint then confirms; a
  fabricated fingerprint refuses with zero writes. Wrong-mode
  refusals in both directions: a TEST-window report type on a
  LIVE connection refuses at read; a LIVE-mode type on a TEST
  connection refuses at read; a wrong-mode created run is
  never claimed (unconfirmed, no run ID surfaced); a
  wrong-mode read-back stays unconfirmed in both modes. The
  aim checks still fire in LIVE: a type whose available window
  does not cover the interval refuses before any write, and
  an unsupported premium type refuses before any write.
- `tests/unit/report-run-write-contract.test.js`,
  `tests/unit/profiles.test.js`,
  `tests/unit/registry.test.js`,
  `tests/unit/report-reads.test.js`,
  `tests/unit/report-result-file.test.js`,
  `tests/unit/report-download.test.js` — run with unchanged
  expectations, all passing, except one recorded admission
  expectation in `profiles.test.js`: its six-area sweep now
  expects `report_run` LIVE-admitted for the owner-approved
  full connection, exactly the change the design card names
  ("`reports` admitted in LIVE for write-eligible profiles");
  every other tool's expectation in that sweep is unchanged.
  The contract suite's bare-LIVE case still refuses with zero
  writes, now produced by the core LIVE-enablement guard
  instead of the deleted handler gate (the Invoices/Files
  precedent).
- Database suites: unchanged; database proof is exact-head
  CI's route on this machine (no local PostgreSQL binaries).
- Full unit suite and `npm run check` on the assembled tree.

## Done when

Met in source: the single operation is admitted in LIVE and
runs the full confirmed-action sequence on synthetic fixtures
in tests — end to end in LIVE on the owner's own connection
and unchanged in TEST — with the report-type allowlist, the
interval bound and the availability verification demonstrably
unrelaxed, creation never reported as completion, no report
contents or file URL surfaced, and every pre-existing refusal
still firing. Docs updated (this card, TOOL-CATALOG report
entries, conformance row 17 V2 progress note, COMPLETION,
STATUS). No DECISIONS entry was needed — no new decision
arose; no disclosure point needed a coordinator ruling (the
card's data-exposure wording and the module's standing
result-file rules agree). **Live proof remains open** (CAP-5
queue): a real LIVE report run happens only when the owner
elects to generate a report over real figures; this family's
proof is source/synthetic until then. No account was
enabled, no LIVE key was used, and no real money moved.
