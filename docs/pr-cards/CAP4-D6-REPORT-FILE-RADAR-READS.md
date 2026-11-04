# CAP4-D6-REPORT-FILE-RADAR-READS — report, file and Radar reads verify in the connection's mode

Status: **SOURCE-IMPLEMENTED.** Family D-6 of CAP-4 (the sixth
CAP-4 family built, in the frozen Phase 1 sequence after D-5).
Read paths only: no write handler's mode gate, ceremony or
verification moves — the Radar writes (OWNER-OBEDIENCE-V2-RADAR,
PR #314), the file-link write and evidence import (V2 Files,
PR #316) and the report-run creation write (V2 Reports) are
untouched, the settled CSV disposition (the result-file read
returns identity/metadata only; owner CSV delivery stays the
G-1g browser route) does not change, and the money wiring
(`src/tools/write.js`, `src/core/write.js`, `src/money.js`,
`src/db.js`) is byte-untouched, proven by an empty name-only
diff against the baseline. Baseline: `main`
`8c7f780f0e04b91c44904d57787d1037fb0eb2ce` (PR #327, CAP-4 D-5).
Design record: the frozen card
`card-report-file-radar-reads.md` and `coordinator-rulings.md`
in the coordinator's design folder; the card states no blocking
forks for this family and none were found.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The frozen card's radar trace names `radar_get_value_list`, `radar_list_value_list_items` and `radar_get_value_list_item` among the family's reads | None of the three exists anywhere in `src/`. The registry's radar read family (`src/tools/radar-reads.js`) is six tools: `radar_list_fraud_warnings`, `radar_get_fraud_warning`, `radar_list_reviews`, `radar_get_review`, `radar_list_value_lists`, `radar_list_list_items` | **Naming/census drift, not a scope change** (the D-4/D-5 precedent): the family is still 12 tools (reports ×4 including the result-file read in its own module, files ×2, radar ×6) and this card uses the registry names throughout. The card's claimed 14 operations reconcile to these 12 registry read tools; no further report, file or Radar read operation exists in `src/` to convert, and none is invented |
| `fileSafe` is already mode-parameterized (V2 Files, PR #316) but its read callers pass no mode | Confirmed exactly: `file_list` called `fileSafe(v)` (no expected ID, no mode) and `file_get` passed the expected ID but no mode, so on the read path every file verified under the historical no-mode check even on a TEST connection | The projection is unchanged; both read callers now pass the connection's mode (`fileSafe(v, null, mode)` / `fileSafe(obj, a.fileId, mode)`). The write-side caller (`file-links-write.js`) already passed the mode and is untouched |
| Radar projections already take an optional mode (V2 Radar, PR #314) but the read handlers call without it | Confirmed: `checked()` is strict-parameterized (`v.livemode !== (mode === 'live')`, an undefined mode meaning TEST), while the read `list()`/`get()` helpers invoked the shape functions with the value only | The projections are unchanged; the helpers now wrap the shapes with the connection's mode, and `radar_list_list_items`' closure passes it to `valueItemSafe`. The write modules that already pass mode (`radar-writes.js`, `radar-list-lifecycle.js`) are untouched |
| Reports are the least converted: a wrapper gate plus projection hard-checks in `report-reads.js`, and a separate gate plus hard-checks in `report-result-file.js` | Confirmed: a post-hoc wrapper refused every non-TEST connection for all three report-read tools; the result-file handler carried its own mode check; `run()`/`resultFile()` hard-required `livemode === false`, while `reportType()` and `safeFile()` refused only a `livemode === true` object | Gates deleted; each projection parameterized per its own baseline semantics (next rows). The result-file read verifies **both** the run and the file object against the mode, as the frozen card requires |
| One verification semantics fits all projections (the D-4 `{required:true}` shape) | The family's baselines differ per projection, and the D-5 lesson governs: the semantics that leave the baseline read set unchanged win, per projection | **`reportType` and `safeFile`: boolean-present semantics.** The baseline checks refused only `livemode === true`; with a mode supplied, a present boolean `livemode` must equal that mode, and a missing/non-boolean one still projects — the family's own V2 `fileSafe` idiom. Baseline evidence: the pre-existing result-file suite's file fixture carries **no `livemode` at all** and must project, which rules out required semantics for `safeFile`; the same loose shape in `reportType` takes the same semantics. **Run projections (`run`, `resultFile`): strict semantics, parameterized in place** (`v.livemode !== (mode === 'live')`), because the baseline strictly required `livemode === false`. This family's deliberate difference from D-4's assert-first shape: in-place parameterization preserves both the baseline read set **and** the baseline refusal texts byte-identically (next row). **`fileSafe` and the Radar `checked()`: no change at all** — already parameterized by V2 with exactly these semantics (boolean-present and strict respectively) |
| TEST-visible text stays byte-identical unless the contract names a change | Every pre-existing refusal and validation text in the four modules is preserved verbatim, including the TEST-worded ones (`'Stripe TEST report run identity or status invalid'`, `'Authenticated TEST report run could not be verified'`, `'Only selected TEST file purposes and cursors may be listed'`), and the mode-aware texts V2 already shipped (`'Verified LIVE file metadata…'`, `'Cannot verify exact LIVE Radar record'`) now also fire on the read path | **No TEST-visible text change in this family.** The one accepted posture change is the sibling families': a connection the seam cannot serve at all (no mode, or LIVE not enabled) is now refused by the shared seam (`modeClient` / `selectedAccountClient`) instead of the deleted gate texts (`'Report reads require TEST mode'` and siblings) — the same outcome for the correct reason (the D-2/D-4 pattern). The pre-existing suites' LIVE-refusal assertions pass unchanged, now produced by the enablement path. Internal composites that call these handlers (`workflow-month-close-find.js` reaches `report_get_result_file` through `nativeRead` with the caller's context) pass real connection contexts, so the mode flows with no composite change |
| The four modules' gates are the family's only mode-shaped surfaces | **Unenumerated gate found:** `report_list_types` returned a TEST-hardcoded output literal, `scope: 'complete_TEST_report_type_catalog_sorted_by_id'` — the D-1 species (a TEST-hardcoded output riding a read result) | Converted in-family: the literal is parameterized by the connection mode (`complete_LIVE_…` on a LIVE connection); the TEST output is byte-identical, pinned by test. The hunt otherwise came up empty, recorded so the negative is on record: no mode-shaped ID pattern exists in this family (the `frr_`, `file_`, `issfr_`, `prv_`, `rsl_` and `rsli_` patterns carry no mode segment, unlike D-5's `cs_test_`), and no store-layer refusal sits on any of the twelve read paths — all twelve are pure provider reads |
| The G-1g report CSV download (`src/stripe/report-download.js`) is part of this family's conversion surface | It hardcodes `mode: 'test'` and TEST checks, but it is an owner-authenticated substrate route the module itself marks "never returned to MCP": no registry tool reaches it and no read handler calls it | **Observed and dispositioned, not converted.** It belongs to the settled CSV disposition the frozen card holds unchanged; converting the owner download route is a different unit if it is ever wanted. Recorded here so the TEST-bound module is a decision on record, not an oversight |
| Baseline quirks ride along untouched | Confirmed one: the result-file module's `safeFile` admits file sizes up to 1e12 while `fileSafe` caps at 1e9 — a pre-existing inconsistency between the two file projections, unrelated to mode | **Preserved, not fixed** (the D-4 precedent): recorded here for a future tidy-up card; widening or narrowing either bound is not this family's work |

## Build contract, as built

- `src/tools/report-reads.js` — the wrapper gate is deleted and
  `fail` leaves the import list. Handlers resolve the client
  through the shared `guarded`/`modeClient` seam (unchanged
  shared code) and pass `ctx.connection.mode` into `reportType`
  (boolean-present semantics) and `run` (strict, parameterized
  in place). The `report_list_types` result `scope` literal is
  mode-parameterized. No provider call, paging rule or
  projection field changes.
- `src/tools/report-result-file.js` — the handler's own mode
  check is deleted; the baseline order is preserved
  (`safeArgs` first, then the seam client inside the existing
  TypeError-to-`fail` catch). `resultFile(run, mode)` is strict
  in place; `safeFile(file, expectedId, mode)` is
  boolean-present. Both objects are verified against the mode
  before any metadata is projected, and a wrong-mode run
  refuses before the file is ever retrieved.
- `src/tools/file-reads.js` — the handler mode ternaries are
  deleted; `file_list` and `file_get` pass the connection mode
  into the unchanged V2 `fileSafe`. The purpose allowlist, the
  cursor and ID validation and every refusal text are
  byte-identical: the conversion changes mode handling only.
- `src/tools/radar-reads.js` — the `list()`/`get()` helpers'
  mode ternaries are deleted; the shapes are wrapped with the
  connection mode, and the `radar_list_list_items` closure
  captures it for `valueItemSafe`. The projections
  (`warningSafe`, `reviewSafe`, `valueListSafe`,
  `valueItemSafe`, `checked`) are unchanged V2 code. The
  pre-gate argument refusal in `radar_list_list_items`
  (`'Exact Radar value list ID required'`) is argument
  validation, not a mode gate, and stands.
- Header comments in the four modules no longer claim TEST-only
  reads (accuracy bookkeeping only).

## The three binding invariants, and their proving tests

1. **Signed report URLs are never exposed in any result, in
   either mode.** Proven by `never exposes a signed report URL
   in either mode (invariant 1)`: report run fixtures carry a
   signed-URL sentinel at the top level and inside the result
   object, and the serialized list, get and result-file results
   on both connection modes contain no `files.stripe.com`, no
   sentinel and no link host. The projections project the
   result file's ID only, with `downloadUrl: null` — unchanged
   field sets in both modes.
2. **The Radar privacy invariant (V2 Radar ruling): results
   identify value-list items by ID and type only; raw values
   never appear in results or audit text, in either mode.**
   Proven by `never exposes raw Radar values in either mode
   (invariant 2)`: fixtures carry `SECRET_IP`, `SECRET_ZIP` and
   `SECRET_EMAIL` sentinels; the serialized results of all six
   Radar reads on both modes match none of them, and the item
   projection's key set is pinned to exactly
   `{createdAt, hasValue, id, valueListId}` — there is no
   `value` field to leak through.
3. **File reads' purpose/SSRF bounds are not relaxed by the
   conversion (V2 Files ruling).** Proven by `does not relax
   the purpose bounds in LIVE (invariant 3)`: on a LIVE
   connection an unlisted purpose (`identity_document`) is
   refused as a list argument, as a listed member and as a get
   result, exactly as on TEST. The allowlist
   (`dispute_evidence`, `finance_report_run`, `business_logo`,
   `business_icon`), the contents/public URL withholding and
   the size bounds are untouched code.

## Budget

The everyday catalog stood at **19,998 tokens** against the
20,000 cap at this baseline — two tokens of headroom. The
twelve dual-mode descriptions were fitted **inside this family
only**: both-mode naming (`TEST or LIVE`) and every behavior
clause are retained (no signed links, no contents URL, no
contents or links, no customer details, no address/IP, no item
values, no raw values, exact covered periods, the purpose
bound), paid for by dropping filler and naming words the tool
names and areas already carry (`provider-available`,
`financial`, `early`, `Radar` as a qualifier, `safe`, `one`,
`private`, `linked`, `definitions`, the enumerated purpose list
— the purposes live in the `purpose` argument's enum). The
catalog reads **19,998** on the final tree, exactly the
baseline reading. The cap did not move and no other family's
text was touched.

## Named tests

New suite `tests/unit/cap4-d6-report-file-radar-reads.test.js` —
**18 tests, 10 fail at baseline `8c7f780f`, all 18 pass after**;
the full unit suite and `npm run check` are green on the final
tree (budget step included, 19,998 above). Database tests
cannot run locally on this machine (no PostgreSQL binaries);
their proof is exact-head CI's, as for every sibling family.

- LIVE happy paths (fail at baseline): verified LIVE report
  types (with the LIVE scope literal), runs and run get;
  verified LIVE result-file run and file; verified LIVE files
  in list and get; verified LIVE Radar warnings, reviews,
  value lists and items.
- Wrong-mode refusals: wrong-mode report runs refused on both
  connection modes; a wrong-mode result-file run refused
  before any file read, both directions; wrong-mode result
  files refused on both modes; wrong-mode files refused on
  both modes with the refusal text naming the connection's
  mode; wrong-mode Radar records refused on both modes.
  Three of these fail at baseline on the post-conversion
  evidence the tests name (the provider call made before the
  refusal; the LIVE refusal text), and two result-file
  refusals are outcome-identical at baseline — each accounted
  below.
- Semantics pins: the boolean-present report-type semantics
  (a no-`livemode` type projects on both connections; a
  wrong-mode boolean refuses); the historical no-`livemode`
  result file still projects on TEST.
- The three invariants above, each proven in both modes.
- **Baseline passes, accounted honestly (8):** the
  byte-identical TEST report pin (scope literal included —
  TEST was already fully served); invariant 1, whose LIVE leg
  passes vacuously at baseline through the gate refusal and
  after conversion on the success path; the two result-file
  wrong-mode refusals (gate on the LIVE side at baseline, the
  strict run check and the `livemode === true` file check on
  the TEST side); the historical no-`livemode` result file
  (the fixture shape that forced boolean-present semantics);
  invariant 3 (the bounds refuse after conversion exactly
  where the gate refused before); and the `fileSafe` and
  Radar projection no-mode contract pins — the V2 machinery
  D-6 did not change, only started passing the mode into.
- The four pre-existing family suites (`report-reads`,
  `report-result-file`, `file-reads`, `radar-reads`) pass
  unchanged in assertion; the pre-existing LIVE-refusal
  assertions are now produced by the seam's enablement path
  and the projections instead of the deleted gates.

## CAP-5 obligation

Live proof for D-6 stands in the CAP-5 queue: one report type
and run read, one result-file read, one file list/get and one
Radar review plus value-list/items read on the owner's LIVE
connection, each returning the owner's own LIVE objects with
the field sets above, and the signed-URL and raw-value
invariants holding on the live results. Source completion
does not close it.

## Not done

Radar writes and value-list lifecycle (V2, PR #314 — untouched);
file upload and file-link creation (V2 Files — untouched); the
report-run creation write (V2 Reports — untouched); the G-1g
owner CSV download route (dispositioned above, unchanged); the
`safeFile`/`fileSafe` size-bound inconsistency (recorded
above, preserved); families D-7 and later.
