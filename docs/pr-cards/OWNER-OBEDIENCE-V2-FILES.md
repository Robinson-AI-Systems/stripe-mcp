# OWNER-OBEDIENCE-V2-FILES — LIVE file evidence import and public file links confirmed-action conversion

Status: **SOURCE-IMPLEMENTED.** Family 9 of 13 of conformance
row 17, conversion **V2** (appendix mechanism 28). This is
corrective work inside the already-merged file choreography
(G-2b1/G-2b2); it completes no predefined batch subsection and
must not be counted as one.
Baseline: `main` `f054274743e03c78c8a8911e12a86c174c18f097`
(after PRs #303–#314: V1, the V2 shared machinery, V4, Money,
Disputes, CI speed, Payments, Invoices & credit notes, Billing,
Checkout, Radar); rebased onto `1449e8de` (PR #315, Identity)
before landing, with the three shared-doc interleaves (STATUS,
conformance, COMPLETION) resolved by keeping both families'
records. Design draft:
`~/workspace/stripe-v2-design/card-files.md`; census:
`~/workspace/stripe-v2-design/census.md` Family 9; coordinator
rulings: `~/workspace/stripe-v2-design/coordinator-rulings.md`.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The design card's baseline is current | The card was drafted against `94813299` (pre-V2-shared); the shared machinery it names as future work (preview-fingerprint binding in `src/core/write.js`, the mode-aware client seam) has since landed in PR #304, and Families 1–8 have converted | Built on current `main`; the card's reuse list is satisfied by the merged machinery, not rebuilt |
| The two file writes are LIVE-refused only | Area `files` is in neither dispatcher set (`src/core/profiles.js`), so both tools were unreachable in **both** modes — the same both-modes wiring situation as Family 4 | Admit the area in both modes and convert the handler gates; the TEST reachability change is stated plainly here and in STATUS |
| Removing the two handler gates and adding the area is sufficient | Three more mode gates exist that the census did not enumerate: the account read in `evidence-upload.js` refused any `livemode===true` account; its `verify` hard-required `after.livemode!==true`; and the shared safe projection `fileSafe` in `src/tools/file-reads.js` refused any `livemode===true` file, which would have refused every LIVE brand file in the link preflight | All mode-parameterized to equality with the connection's mode, exactly like the enumerated ones; none deleted. `fileSafe` takes an optional `mode` (the Billing `discountSafe` / Radar projection precedent): write callers pass the connection's mode, the read tools call without one and keep the historical check and wording byte-identically |
| Fingerprint confirmation works once the handler gates are gone | Both modules validate arguments with the shared `validateFields` (billing-shared), which rejects any field outside the per-tool property set — `previewFingerprint` included — so a fingerprint confirmation would throw before reaching the core check (the Radar species) | Family-local resolution (the Payments/Invoices/Radar idiom): both modules strip `previewFingerprint` from a shallow copy before validation, and both tool schemas declare it |
| The evidence preview "names the target dispute" (design card disclosure line) | The tool takes no dispute argument and attaches nothing by design: it imports a file into dispute evidence storage for the account, and the dispute pipeline (Family 2) attaches and submits it later. There is no target dispute in scope to name | **Conservative form built; flagged for coordinator ruling.** The preview names the target storage and account, states the source host and filename, and states plainly that the import does NOT attach or submit a dispute; in LIVE it adds that the file becomes real evidence material on the LIVE account and that the dispute flow may later send it to the issuing bank. No input-contract change was improvised to satisfy the card's wording. If the coordinator rules a dispute argument should exist, that is new construction, not part of this conversion |
| Evidence import is a general file tool sequenced with the disputes card | Family 2 (Disputes) converted in PR #308, before this family in the frozen sequence; the import's read-back ties to the account and the created file, not to a dispute object | No sequencing change needed; the dispute pipeline's own evidence handling was mode-parameterized by Family 2 and is untouched here |
| The family's proof suites are the existing `file-links.test.js` / `evidence-upload.test.js` | Those suites pin the TEST-mode contract; the merged families' idiom (Invoices, Radar) keeps their expectations unchanged and puts conversion proof in a new suite | Conversion proof lives in the new `tests/unit/files-live-conversion.test.js`; both pre-existing suites pass with unchanged expectations — including the two bare-LIVE cases, whose refusal is now produced by the core LIVE-enablement guard instead of the deleted handler wrappers, exactly the Invoices precedent |
| JIT cards are registered in `docs/pr-cards/work-index.json` | None of the merged V2 cards (SHARED, MONEY, DISPUTES, PAYMENTS, INVOICES, RADAR) is registered there; the index validator passes without them | This card follows that precedent; no index change |

## Build contract, as built

- `src/core/profiles.js`: **`files` is added to
  `guardedTestAreas` and to `guardedLiveAreas`** — the
  dispatcher admission this family needed, in both modes, for
  exactly the two tools (`file_upload_evidence`, area `files`,
  profiles `everyday`/`full`; `file_create_link`, area `files`,
  profile `full` only, as built). No other area's admission
  changes: without the owner-approved LIVE connection the LIVE
  admission still refuses, and `read_only` still refuses
  everything. Neither tool is a money tool, so no funding term
  applies; rows 20–21 are untouched.
- `src/tools/evidence-upload.js`: the handler TEST gate is
  gone; handlers dispatch directly. The `read` account check
  keeps the exact-identity proof and replaces the
  `livemode===true` refusal with
  `assertAccountResourceMode(account, connection mode)`; the
  identity error is mode-parameterized with the TEST wording
  byte-identical. `verify` demands the read-back file's mode
  equal the connection's mode (a present `livemode` that
  disagrees fails verification; the historical TEST behavior
  for boolean fixtures is unchanged). Import bounds stay
  exactly as built: public HTTPS source URL with SSRF defense,
  PDF/PNG/JPEG only (declared name, downloaded bytes and
  extension must agree), 10 MiB maximum. The result still
  carries only the file ID, purpose and size — no source URL,
  no bytes, `contentsUrl: null`, `evidenceSubmitted: false`.
- `src/tools/file-links-write.js`: the handler TEST gate is
  gone; handlers dispatch directly. The `read` preflight
  passes the connection's mode into `fileSafe`. `apply`
  refuses a created link whose present `livemode` disagrees
  with the connection's mode, and `verify` demands the
  read-back link's mode match as well. **The scope aim checks
  stay byte-for-byte in effect**: brand-asset purposes only
  (`business_logo`/`business_icon`), mandatory expiry between
  1 minute and 24 hours, and the handler's post-creation
  re-read that withholds the URL (`publicUrl` is emitted only
  when the re-read verifies unchanged) is untouched.
- `src/tools/file-reads.js`: `fileSafe(v, expectId, mode)`
  gains the optional mode parameter described in the drift
  table. The two read tools (`file_list`, `file_get`) are NOT
  converted: they call `fileSafe` without a mode, keep their
  own TEST-only handler gates, and behave byte-identically —
  read reachability belongs to the CAP-4 read work, not this
  family's write conversion.
- Disclosure: summaries are mode-labeled. The link preview
  states in plain words that the link is public — "Anyone
  with the URL can fetch the file until it expires" — and
  shows the exact expiry, in both modes (the sentence is new
  in TEST too; the card requires it of "the link preview"
  without a mode qualifier, and no pre-existing assertion
  pinned the old wording). The evidence preview keeps its
  TEST text byte-identical and in LIVE adds that the file
  becomes real evidence material on the LIVE account and
  that the dispute flow may later send it to the issuing
  bank; both modes state the import does NOT attach or
  submit a dispute. Tool descriptions are mode-neutral and
  ≤ 160 characters.
- Content discipline: previews and results identify a file
  by Stripe ID, purpose, size and type only. No file bytes,
  no source URL beyond the hostname already shown in TEST,
  and no download URL beyond the verified public link the
  tool exists to create (and only after the unchanged
  post-creation re-verification) surface in any preview,
  result or audit record.
- Reused, not rebuilt: the `defineWrite` lifecycle (fresh
  read, app-ownership target guard, preview, `confirm`,
  `rmcp_` idempotency, `recordChange` journal, `verify`
  read-back), the shared preview-fingerprint binding in
  `src/core/write.js` (a drifted confirmation refuses with
  the fresh preview and fingerprint disclosed and executes
  nothing), `authorizeLiveWrite` as the LIVE-enablement
  guard, and `modeClient` for provider resolution.
- Money discipline: file writes move no money, and
  `src/tools/write.js`, `src/money.js` and `src/db.js` are
  byte-untouched by this card (verifiable in the diff).

## Named tests

- `tests/unit/files-live-conversion.test.js` — **new, 13
  tests.** Dispatcher admission: the registry carries exactly
  the two family tools; both admitted in TEST for their write
  profiles and refused for `read_only` (the link tool stays
  full-only); both admitted in LIVE only on the owner-approved
  connection (neither is a money tool, so no funding term
  applies); the TEST and LIVE owner catalogs both list both
  (TEST reachability is new for this family). TEST end-to-end:
  the evidence import dispatches through the `handlers`
  export with the gate gone; a preview fingerprint binds the
  confirmation — a fabricated fingerprint refuses, account
  drift between preview and confirm refuses with the fresh
  fingerprint disclosed and nothing executed (no download,
  no provider write), and the fresh fingerprint then
  completes; the link preview discloses public reachability
  and the exact expiry and its fingerprint confirms exactly
  once. LIVE (owner connection, fake provider + fake
  database): the evidence import completes preview → confirm
  with the LIVE disclosure (real evidence material, issuing
  bank, not-attach/not-submit) and returns only the file ID;
  a wrong-mode read-back file leaves it unconfirmed; a
  wrong-mode account refuses at read with no download; a
  wrong file type still refuses in LIVE; the file link
  completes preview → confirm and returns the public URL only
  after verification; wrong-mode files refuse at read in both
  directions; a LIVE dispute-evidence file is refused a link
  (brand scope unrelaxed); a wrong-mode created-link
  read-back stays unconfirmed with no URL surfaced.
- `tests/unit/file-links.test.js`,
  `tests/unit/evidence-upload.test.js`,
  `tests/unit/file-reads.test.js`,
  `tests/unit/dispute-evidence-draft.test.js`,
  `tests/unit/evidence-source.test.js`,
  `tests/unit/profiles.test.js`,
  `tests/unit/registry.test.js` — run with unchanged
  expectations, all passing: every pre-existing refusal still
  fires, including the bare-LIVE cases now refused by the
  LIVE-enablement guard.
- Database suites: unchanged; database proof is exact-head
  CI's route on this machine (no local PostgreSQL binaries).
- Full unit suite and `npm run check` on the assembled tree.

## Done when

Met in source: both operations are admitted in both modes
and run the full confirmed-action sequence on synthetic
fixtures in tests — end to end in TEST (reachability itself
new) and in LIVE on the owner's own connection — with the
brand-asset scope guard, the expiry requirement, the
URL-withholding re-verification and the import bounds
demonstrably unrelaxed, and every pre-existing refusal still
firing. Docs updated (this card, TOOL-CATALOG file entries,
conformance row 17 V2 progress note, COMPLETION, STATUS).
No DECISIONS entry was needed — no new decision arose; the
one flagged disclosure point above is recorded for the
coordinator's ruling, not decided unilaterally. **Live
proof remains open** (CAP-5 queue): a real LIVE evidence
import or brand link happens only when the owner elects to
act on a real file; this family's proof is source/synthetic
until then. No account was enabled, no LIVE key was used,
and no real money moved.

## Coordinator ruling (2026-11-04) — the evidence preview names no target dispute

The conservative form built here PREVAILS. The evidence import takes no dispute argument by design — it is import-only, and the Disputes family's own pipeline attaches and submits evidence later (see the Disputes card, PR #308). A preview that "named the target dispute" would be naming a target the tool does not have, which is fiction, not disclosure. The preview instead names the target storage and account and states plainly that the import does not attach or submit anything. Adding a dispute argument to this tool would be new construction outside this conversion; if it is ever wanted, it is its own card in the Disputes workstream, not an amendment here.
