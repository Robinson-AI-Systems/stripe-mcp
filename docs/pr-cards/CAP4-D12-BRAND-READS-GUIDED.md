# CAP4-D12-BRAND-READS-GUIDED — Brand reads and guided tools follow the connection mode

Status: **SOURCE-IMPLEMENTED.** Family D-12 of CAP-4 (the ninth
CAP-4 family built, in the frozen Phase 1 sequence after D-11).
Read and guidance paths only: no branding write handler is
modified, no write handler's mode gate, ceremony or verification
moves, and the money wiring (`src/tools/write.js`,
`src/money.js`, `src/db.js`) is byte-untouched, proven by an
empty name-only diff against the baseline. Baseline: `main`
`d2f24c74cf09efea1384c3fa8d04fc637173465a` (PR #330, CAP-4
D-11). Design record: the frozen card `card-brand-reads.md`
and `coordinator-rulings.md` in the coordinator's design
folder; the annex below rests on the D-7 ruling recorded in
CAP4-D7-ACCOUNT-ADMIN-READS and `coordinator-rulings.md`.

## Scope, as built

Nine registry tools carry the frozen card's conversion:
`brand_get` (`src/tools/brand-kit.js`);
`brand_list_invoice_templates` and
`brand_get_invoice_template`, and the six guided tools
(`brand_set_account_branding`,
`brand_set_statement_descriptor`, `brand_set_public_details`,
`brand_set_invoice_defaults`, `setup_set_card_safety`,
`setup_set_dashboard_timezone`) in
`src/tools/brand-account.js` — claiming the 2 census
operations (the invoice-rendering-template GETs);
`brand_get`'s provider subject is `GET /v1/account` (claimed
by D-7) plus the local mode-partitioned kit store. The
guided tools are `writes: false` because they do not write:
they return Dashboard steps and a read-back verification,
and the owner performs the change in the Dashboard.
Converting them means the guidance and the read-back work
for a LIVE account; it does not make them writes.

**Annex (D-7 coordinator ruling, distinct from the frozen
card's scope):** D-7 converted the shared admin gate, which
carried the two admin guided tools
(`admin_list_guided_settings`, `admin_check_setting` in
`src/tools/admin-guided.js`) — their gate follows the
connection mode and their payload `mode` is truthful since
PR #329, but their descriptions and remaining TEST-shaped
text were expressly left to this card. The annex discharges
that remainder (below).

## The conversion

The mode-aware twins already existed from V2's write
conversion; the reads adopt them — no new idiom:

- **Guided tools** dispatch on `selectedEitherMode` (was:
  the TEST-only `selected`, refusing with 'TEST
  own-account guidance only') and read back through
  `modeAccount` (was: `testAccount`). Guidance text is
  mode-templated: the spec steps are written once with the
  TEST word, and a LIVE connection receives the same steps
  naming LIVE — the mode the owner is actually working in;
  every other word is unchanged. The reply payload's `mode`
  reports the connection mode, and the manual settings URL
  is mode-templated (below). The observed-value read-back
  verifies against the mode-verified account, so a
  wrong-mode provider account refuses in both directions.
- **Template reads** ride `modeAccount` (was:
  `testAccount`); `safeTemplate` gains an optional mode
  parameter the read callers supply (semantics below). The
  write path calls it without a mode and is byte-identical.
- **`brand_get`** rides `verifiedMode` (was: the TEST-only
  `verified()`), re-reads the account with the mode-matched
  verified reader (the baseline's second read, parameterized),
  reads the kit revision for the connection's own mode
  partition (the store was already mode-parameterized by
  V2; only the read was pinned to `'test'`), and reports
  `mode` as the connection mode.
- The now-dead TEST-only helpers are removed: `selected`
  and `testAccount` in `brand-account.js`, `goodAccount`
  and `verified` in `brand-kit.js` — after the conversion
  they had no callers (the D-11 unused-import precedent).
  The module comments that recorded V2's deferral ("the
  guided handlers and template reads keep the TEST-only
  selector") are updated to record this discharge.

**Write handlers NOT modified** (the byte-untouched proof
for the family's writes): in `brand-account.js` —
`templateWrite`'s `defineWrite` pair
(`brand_archive_invoice_template`,
`brand_unarchive_invoice_template`), `portalLook`
(`brand_set_portal_look`), the `setup_set_payout_schedule`
exposure, and `validateGuide`/`observedGuide` (the guide
argument validation and observation logic itself); in
`brand-kit.js` — `makeBrandKitSave` (`brand_save_kit`),
`makeBrandImageUpload` (`brand_upload_image`),
`brand_preview_checkout` and `verifiedMode` itself. The one
shared projection the template writes call, `safeTemplate`,
gained an optional parameter they do not pass; their behavior
is pinned unchanged by the pre-existing suites
(`brand-account.test.js`, `branding-live-conversion.test.js`)
passing unedited.

## Annex conversion (admin guided tools)

- `admin_check_setting`'s description names the connection
  mode (was: 'native TEST setting readers').
  `admin_list_guided_settings`' description carried no mode
  claim and is unchanged.
- Every remaining TEST-shaped string in `admin-guided.js`
  was reviewed: the `NATIVE_SETTING_READS` scoping comment
  no longer calls the selected account a TEST account, and
  the D-7 comment in `admin_list_guided_settings` now
  records this discharge. The two note strings D-7 already
  mode-parameterized are untouched, as is every handler in
  the module (`readNative`, `asGuide`, the verification
  flow logic) — the gate and payload were D-7's conversion.
- D-7's suite pinned the guided list payload and the
  check-setting identity-refusal note in both modes, but
  not the full verification flow; this build's suite pins
  `admin_check_setting`'s observed path end-to-end
  (identity read + native webhook reader) in both modes.
- Examined and left: the step texts in
  `src/data/dashboard-map.js` contain TEST references —
  they direct verification with synthetic TEST artifacts
  ('Save and inspect a TEST invoice preview'), a deliberate
  safety posture, not the connection's Dashboard mode (the
  one step naming Dashboard mode already says 'TEST or
  LIVE'). They are not falsehoods on the LIVE path D-7
  opened, and the data file is outside the annex's named
  surface; no change.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| Guided dispatch refuses at `brand-account.js:338` with "TEST own-account guidance only"; template reads ride `testAccount` | Exactly as cited at the shipped baseline | Converted: dispatch on `selectedEitherMode`, reads on `modeAccount`; the refusal is corrected (behavior changes, item 1) |
| One brand gate | Two modules, two selectors, as the frozen card records: `brand-account.js`'s `selected`/`testAccount` and `brand-kit.js`'s `goodAccount`/`verified` | Both converted via their V2 twins (`selectedEitherMode`/`modeAccount`, `verifiedMode`); no new idiom |
| The kit store needs mode work | V2 already mode-parameterized the store; only `brand_get`'s gate and its hardcoded `mode:'test'` kit read kept the read TEST-only | `brand_get` adopts `verifiedMode` and reads the connection's partition |
| `brand_get` verifies the account once | It verifies twice: `verified()` and a second `readVerifiedTestAccount` for the branding projection | Both reads parameterized by mode (the second read is mode-matched), preserving the baseline call structure |
| Unenumerated gates (the hunt every family runs) | (a) The guided reply's `manualSettingsUrl` hardcodes the TEST Dashboard root (`https://dashboard.stripe.com/test/settings`) — a mode-shaped URL inside the guidance payload the census did not enumerate; (b) the D-8 composite in `workflow-brand-business.js` consumes `brand_get` through the caller's ctx; (c) a write-path refusal in `brand_set_portal_look`'s read ('App-bound TEST Portal ownership cannot be proven') names TEST even on a LIVE connection | (a) Mode-templated: LIVE receives `https://dashboard.stripe.com/settings`, TEST byte-identical, pinned by the new suite and by the pre-existing brand-account suite passing unedited; (b) recorded as a consequence — the composite inherits both modes through this conversion with no composite change; D-8 still owns the composites' own conversion; (c) recorded, not converted — a V2 write-path text, outside this card (branding writes are not this card) |

## Semantics (fitted to baseline evidence; the D-5 lesson)

- **Account verification** is the V2 twins' strict
  semantics, unchanged: exact account identity plus
  `livemode` equal to the connection mode, with the
  verified readers' independent balance evidence — in both
  directions, for the guides, the template reads and
  `brand_get` alike.
- **Template projection** uses **default (optional-evidence)
  semantics**: `safeTemplate(t, mode)` verifies via
  `assertAccountResourceMode(t, mode)` only when a mode is
  supplied by a read caller. Baseline evidence: the
  baseline list fixture carries no `livemode` at all and
  was served, and the projection returned
  `livemode: t.livemode??null` without refusing — required
  semantics would shrink the baseline TEST read set. A
  member carrying boolean evidence of the wrong mode
  refuses the whole read (list) or the get, with the
  standard 'Stripe provider resource mode mismatch' text.
  No-mode callers (the template writes) are byte-identical.
- **`brand_get`'s kit read** follows the connection's mode
  partition; the partitions are separate records (V2), so a
  LIVE read can never surface the TEST kit or vice versa.

## Card-named behavior changes (the complete list)

1. **Guide refusal correction:** an unselected account now
   refuses with 'Own-account guidance requires a selected
   account' (was: 'TEST own-account guidance only' — the
   old text asserted TEST as a requirement rather than the
   caller's situation; the frozen card's one named refusal
   correction). On a LIVE connection with a selected
   account the guides now serve instead of refusing.
2. **Mode reachability:** all nine tools serve LIVE
   connections (baseline: refused at the selectors/gates).
   Wrong-mode provider accounts and wrong-mode template
   members refuse in both directions.
3. **Guidance text names the working mode:** on a LIVE
   connection the steps name LIVE (the mode word is the
   only wording change), the payload `mode` is `'live'`,
   and the manual settings URL is the live Dashboard root.
   On TEST every payload is byte-identical to baseline
   (pinned by a full-output `toEqual` and by the
   pre-existing suites passing unedited).
4. **Descriptions** name the connection mode for the nine
   card tools and the annex's `admin_check_setting`
   (fitted, below). No output field, output value or TEST
   behavior changes beyond items 1–3.

## Budget

Dual-mode wording was fitted inside this family's own
descriptions only. The everyday catalog counts the four
all-profile read descriptions (the six guided tools are
full-profile and uncounted there): their combined
gpt-tokenizer count is 58 at baseline and 58 after fitting
(the naive dual-mode wording read 64), so the everyday
catalog holds at **19,997 tokens against the 20,000 cap —
net zero**, measured with the repository's own budget
script on both trees. Final fitted wording, for the record:
the template list drops 'TEST Stripe … observed' for the
mode clause ('List bounded rendering templates and archive
status in the connection mode.'); the template get drops
'safe … TEST Stripe' ('Read selected rendering template
identity and status in the connection mode.'); `brand_get`
drops 'the selected TEST account' ('Read kit revision and
provider-visible branding in the connection mode.'); the
annex's `admin_check_setting` drops 'native TEST … when
available' ('Observe setting readers in the connection
mode; Dashboard-only changes remain unverified and
read-only.' — the native/Dashboard-only contrast survives
in the second clause and in the handler's own note text);
and the uncounted guided description drops 'requested
TEST' ('Inspect own-account settings in the connection
mode; return safe Dashboard steps, never claim a write.').
Every behavior clause survives in each; the cap did not
move and no other family's text was touched.

## Proof

New suite `tests/unit/cap4-d12-brand-reads-guided.test.js`:
25 tests — **13 fail at the pristine baseline** `d2f24c74`
(the six LIVE guides; the read-back test's LIVE legs; the
corrected unselected refusal text; template list/get on
LIVE; the wrong-mode template member — baseline served a
live-mode template on a TEST connection because the
projection never verified; the no-livemode template test's
LIVE leg; `brand_get` on LIVE; and the both-modes
descriptions) and all 25 pass after. The 12 baseline passes
are accounted: the six TEST guide shape pins and the full
TEST guide byte-identical pin (TEST was already fully
served); the TEST template list and `brand_get` TEST
partition pins; the `brand_get` wrong-mode account refusal
(outcome-identical — the baseline TEST gates refused both
directions); and the annex observed flow in BOTH modes,
whose behavioral conversion was D-7's carried gate (the
annex's own delta here is the description/text work, proven
by the descriptions test that fails at baseline). The
pre-existing family suites (`brand-account.test.js`,
`brand-kit.test.js`, `branding-live-conversion.test.js`,
`cap4-d7-account-admin-reads.test.js`, `registry.test.js`)
pass unedited. Registry stays 329 tools (no tool added,
removed or renamed). Full unit suite green and
`npm run check` exit 0 on the final tree; database proof
is exact-head CI's route (no local PostgreSQL binaries).

## CAP-5 obligation

Live proof for D-12 stands in the CAP-5 queue: on the
owner's LIVE connection — one guided brand read-back
(steps naming LIVE, observed values verified against the
LIVE account), one invoice-template list and get, one
`brand_get` (LIVE kit partition and LIVE provider
branding), and the annex's `admin_check_setting` observed
flow.

## What was NOT done

- Branding writes — V2's, merged; no write handler in
  either brand module was modified (list in the conversion
  section), including the payout-schedule exposure and the
  app-bound ownership refusal (V3's record), which stays
  exactly as it was. The one TEST-naming write-path refusal
  observed during the hunt is recorded in the drift table,
  not converted.
- Invoice-rendering-template writes stay as they are
  (D-9 keeps them refused: no read-back route) — untouched.
- The dashboard-map step texts (annex: examined and left,
  with the reasoning recorded above).
- No account was enabled and no LIVE key was used; all
  LIVE evidence is fixture-based, as for every sibling
  family.
