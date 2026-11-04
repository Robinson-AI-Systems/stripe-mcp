# CAP4-CONNECT-SLICE-3 — Connect slice 3: connected-account terminal operations

Status: **SOURCE-IMPLEMENTED.** Slice 3 of CAP4-CONNECT — the
last slice of the card, landed separately as ruling 3(ii)
requires for the destructive/terminal class. Three new native
write tools extend slice 2's module, `src/tools/connect-writes.js`
(area `connect`), on the guarded `defineWrite` lifecycle, on
slice 1's foundations exactly as slices 1–2 left them
(`platformAccount` actor verification reused verbatim, the
safe-fields projections, the mode discipline). Baseline: `main`
`b55d3ec99f0b0abbfeda618bdf968ab3a76f2c26` (PR #337,
CAP4-CONNECT-SLICE-2). Design record: the CAP-4 card set
(`card-connect.md` slice 3 definition and build contract,
`coordinator-rulings.md` rulings 3 and 5, the census
reconciliation appendix §CONN) in the coordinator's design
folder; the write contract list is COMPLETION item 3 (preview,
authorized effect, stable replay key, before state, audit,
provider read-back, bounded results).

With this slice, the **Connect family is COMPLETE** in source:
all 45 census operations carry a disposition — 21 built native
tools (7 reads, 11 lifecycle writes, 3 terminal writes) over
the canonical v1 paths, the published-only alias spellings
covered-by-canonical,
the two token-minting classes refused by ruling, and the 15 v2
core operations (incl. the v2 close) covered-by-design-decision
under fork 4 / ruling 3(iv). The universal door's accounts-row
flip remains D-9's, as recorded below.

## The ruled forks, as built (rulings 3 and 5)

1. **Credential class (a), unchanged:** the platform acts only
   via the owner's enrolled connection. The connected account is
   an explicit exact argument on every tool — never implicit,
   ambient or defaulted — and the platform account is verified
   as the actor inside every tool's `read()` before any call
   that touches a connected account, exactly as slices 1–2.
   Slice 3 adds one harder edge, below: the platform account's
   own ID offered as the *subject* of a terminal operation
   refuses inside `read()` before the actor verification makes
   any provider call at all — a terminal operation on the
   platform itself is never a Connect call.
2. **Slicing:** this PR is the destructive/terminal slice only
   (ruling 5: "Slice 3 keeps delete/reject/unreject/close
   only"). Slices 1–2 keep their exact behavior; their suites
   pass with only the baseline-record updates named below.
3. **Minting:** untouched by this slice. `account_links` /
   `login_links` remain slice 2's ruled exception;
   `account_tokens`/`person_tokens` are NOT built and stay
   refused (ruling 3(iii)).
4. **v1 first (ruling 3(iv)):** canonical v1 paths only. The
   v2 close is dispositioned below with its evidence — not
   built, and not half-built through the universal door.

## The ceremony (the card's "strongest ceremony" requirement)

Every slice-3 tool carries the full write contract slice 2
carries — preview naming the exact connected account and the
exact terminal effect; verified platform actor in preview and
audit; stable replay key (a replay re-presents the original
provider result under the same idempotency key); before-state
capture bound into the preview fingerprint; audit record;
provider read-back verification, a mismatch failing the tool
as uncertain, never a success; bounded results — **plus** the
exact-account confirmation shape the card's slice-3 named test
demands:

- Every call must repeat the exact connected-account ID in the
  `confirmAccount` argument (a required argument on all three
  tools, validated at the very top of `read()`, before the
  actor verification — so before *any* provider call, including
  the platform self-reads).
- A missing `confirmAccount` refuses ("Missing required
  argument"); a mismatched one refuses ("The confirmation must
  repeat the exact connected account ID in confirmAccount");
  the platform account's own ID repeated as the confirmation
  refuses the same way (it is a mismatch against the connected
  subject); the platform account's own ID offered as the
  *subject* (with itself repeated) refuses as never a Connect
  terminal subject. All four refusals are pinned by test with
  provider spies proving zero provider calls of any kind.
- The shape applies to previews too: a dry-run without the
  exact-account confirmation refuses identically (pinned).

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| A "repeat the exact target ID" confirmation argument already exists somewhere in the landed write families to copy verbatim | Exhaustive search of `src/`, `tests/` and the JIT cards found **no** string-typed confirmation-ID argument on any tool (no `confirmAccount`-style property anywhere). The strongest ceremony the house actually has is `src/core/write.js`'s fingerprint-bound confirm: a confirmation following a preview must present the `previewFingerprint` computed over tool + platform account + mode + evaluated before-state, re-verified against a fresh evaluation, a stale fingerprint refusing with nothing executed (V2 shared card ruling 5; the V3 catalog ceremony layers `outsideApp: true` on top for known app-owned targets) | Slice 3 layers the card's exact-account repeat **on top of** that lifecycle rather than replacing it: `confirmAccount` is a tool-level required argument in the connect module's established style (camelCase, `acct_` pattern, validated in `read()` like every connect argument), and the standard preview/confirm/fingerprint lifecycle runs unchanged underneath. The behavioral contract the card names — repeat the exact ID; missing/mismatched/platform-as-subject refuse before any provider call — is implemented and pinned exactly; the card records that the argument itself is new with this slice, not copied |
| Reject's `reason` values from general API knowledge (`fraud`, `terms_of_service`, `other`) | The pinned SDK (stripe 23.0.0, `node_modules/stripe/esm/resources/Accounts.d.ts`, `AccountRejectParams`) carries the current field shape: `reason` is **required**, typed `credit \| fraud_no_intent_to_fulfill \| fraud_other \| fraud_payment_method_casher \| fraud_payment_method_tester \| other \| terms_of_service`, plus an optional `payouts_action` of `pause \| none` (default `pause`) | The tool validates `reason` against exactly the seven documented values and exposes the optional `payoutsAction`; the preview shows the exact reason that will be sent. Method names verified against the same pinned typings: `accounts.del(id, params?, options?)`, `accounts.reject(id, params, options?)`, `accounts.unreject(id, params?, options?)` all exist with those exact names (the slice-2 offline-verification pattern) |
| Reject/unreject need a bespoke state field to verify against | Slice 1's safe projection already carries the state: `requirements.disabledReason` (Stripe's `requirements.disabled_reason`), whose pinned value set includes the `rejected.*` family (`rejected.fraud`, `rejected.terms_of_service`, `rejected.other`, `rejected.listed`, `rejected.platform_*`, …) | State read-back verifies through the projection, per the card's named decision ("reject/unreject land in Slice 3 with state read-back via account retrieve"): after reject, the re-read account's projected disabled reason must start with `rejected.`; after unreject it must not. No new projection field, no raw state projected anywhere. The fake world maps each request reason to a Stripe-shaped disabled reason; the tool itself asserts only the rejection family, never an invented 1:1 reason mapping |
| Slice 2's registration pins (11 names, 340/166 totals) are slice-2 facts that slice 3 must not disturb | Slice 3 extends the same module, so the module's tool list and the global totals necessarily move — the same situation slice 2 created for slice 1's pins | The slice-2 precedent is followed exactly: the slice-2 registration test keeps its eleven lifecycle names as an exact prefix assertion and its totals move 340 → 343 / 166 → 169; the slice-1 closing assertion is rewritten from "no slice-3 tool exists" to "slice 3 landed" (below). No behavior pin moved |

## Scope — the exact operation list, with contract disposition per operation

| Tool | Pinned operation | Disposition |
| --- | --- | --- |
| `connect_delete_account` | `DELETE /v1/accounts/{account}` | **Full contract + exact-account confirmation.** Terminal and irreversible; the preview says so in words ("PERMANENTLY DELETES … cannot be restored"). Read-back as slice 2's deletes: the re-read account must carry `deleted: true`; where the provider instead answers `resource_missing` for the deleted account, the read-back synthesizes the deleted marker for the exact ID (both shapes pinned by test). A read-back that still shows a live account fails the tool as uncertain. |
| `connect_reject_account` | `POST /v1/accounts/{account}/reject` | **Full contract + exact-account confirmation**, with the card's named state read-back in place of a direct read-back (Stripe offers no rejection object to re-read): after apply, the account is retrieved and its projected disabled reason must show a rejection (`rejected.*`), mode-verified through slice 1's projection; a provider that silently leaves the account unrejected fails the tool as uncertain. `reason` is required and validated against the pinned SDK's seven accepted values; the preview shows the exact reason that will be sent; optional `payoutsAction` (`pause` default / `none`) is sent as `payouts_action` only when given (both pinned). |
| `connect_unreject_account` | `POST /v1/accounts/{account}/unreject` | **Full contract + exact-account confirmation**, state read-back as for reject, inverted: after apply, the re-read account's projected disabled reason must no longer show a rejection; a provider that silently keeps the rejection fails the tool as uncertain. The before-state's disabled reason is named in the preview, so a reversal is always confirmed against the rejection it claims to reverse. |
| — (not built) | `POST /v2/core/accounts/{id}/close` | **Covered-by-design-decision (fork 4, ruling 3(iv)) — not built, and not routed through the universal door.** Evidence: the operation exists in the pinned census only as a v2 core operation (reconciliation appendix §CONN: `POST /v2/core/accounts/{id}/close [v2]` — v2 core accounts surface); there is no v1 close operation in the pinned catalog, and the v2 core surface has no dispatch surface in this server (no v2 client seam, no door rows — the v2 operations are, in the Connect card's own drift words, "unreachable entirely (no dispatch surface)"). Ruling 3(iv) records all 15 v2 core operations as covered-by-design-decision "until a v2 dispatch unit exists". Building close alone would mean inventing a one-off v2 dispatch path for a single destructive operation — exactly the half-family fork 4 warns against. It is revisited when a catalog re-pin adopts the v2 catalog as a dispatch surface. The v1 terminal story is complete without it: delete (above) is the v1 account-ending operation. |

**Mode discipline** is slices 1–2 unchanged: a call acts in the
connection's mode only; the account read in `read()`, the apply
result's identity, and every read-back verify against the mode
through slice 1's projection (a present `livemode` must match;
the verified platform read is the primary mode proof). A
wrong-mode connected account refuses before apply; a wrong-mode
read-back fails the tool as uncertain (both pinned).

**Safe projections** are slice 1's, unchanged: previews and
audit records carry the projection's safe fields (type,
charges/payouts state, disabled reason) plus the exact account
ID and, for reject, the exact reason being sent — never an
email, tax ID or any identity value (sentinel-pinned).

## Registration points (named exactly)

- `src/tools/connect-writes.js`: the terminal section extends
  the slice-2 module; the three tools are appended to its
  `tools` list (after the slice-2 eleven) and `handlers` map.
  No `src/tools/index.js` change (the module was already
  merged); no `src/core/profiles.js` change (slice 2 already
  admitted the `connect` area to both guarded-door sets; the
  admission covers the terminal writes, pinned by test).
- Money wiring (`src/tools/write.js`, `src/money.js`,
  `src/db.js`) untouched; the universal door untouched.

## Registry, listing and budget treatment (with numbers)

- Registry: **340 → 343 tools; 166 → 169 writes** (174
  read-labelled, unchanged). Visibility: read-only 162
  (unchanged), everyday 255 (unchanged — the new writes are
  `full`-profile only), full 343.
- Everyday catalog budget: **19,999 / 20,000 tokens, unmoved**
  — the slice-2 finding applies unchanged: the budget listing
  counts reads only, so write tools add exactly 0 tokens; no
  cap moved, no text shrunk; the three new descriptions are
  accurate at ≤160 chars (114–120).
- Guarded doors: all three terminal writes are admitted by
  `stripe_call`'s TEST door and, on an owner-approved LIVE
  connection, the LIVE door (pinned by test); compact listing
  is unaffected (writes are never compact-listed).

## Tests and honest baseline accounting

New suite `tests/unit/cap4-connect-slice3-terminal.test.js`
(32 tests) in the slice-1/2 house style, over a stateful fake
provider world (reject lands the Stripe-shaped disabled
reason, unreject clears it, delete marks the account,
idempotency keys replay the original response):

- **Registration:** the three tools appended after the
  slice-2 eleven with the family shape (full profile,
  defineWrite-v1, `confirmAccount` a required string argument);
  registry 343/169; guarded-door admission in TEST and LIVE.
- **The card's named ceremony tests, per tool:** missing
  `confirmAccount`, mismatched `confirmAccount`, the platform
  account's own ID repeated as the confirmation, and the
  platform account's own ID offered as the subject — all four
  refuse before any provider call (provider spies prove
  `accounts.retrieve` was never called and no write method
  ran); a dry-run preview without the shape refuses
  identically; reject's reason and payouts-action shape
  refusals likewise precede any provider call.
- **Per-tool contract:** preview accuracy (exact account,
  exact terminal effect, the exact reject reason), no-confirm
  never writes, confirm = one idempotent write + independent
  read-back + audit pair, replay returns the original result
  under the same idempotency key.
- **State read-back proofs:** reject → re-read shows
  `rejected.fraud` (and `rejected.terms_of_service`,
  `rejected.other` for their reasons); unreject → re-read
  shows the disabled reason cleared and charges restored;
  reject→unreject round-trip on one fake world; a muted
  provider (apply returns success but state does not move)
  fails each tool as uncertain, never a success; delete
  verifies under both read-back shapes (deleted marker and
  provider `resource_missing`) and fails as uncertain when
  the read-back still shows a live account.
- **Actor and mode:** a non-platform connection refuses all
  three tools before any connected-account call (provider
  spies); a wrong-mode connected account refuses before
  apply; a wrong-mode read-back after reject fails the tool.
- **Safe surfaces:** sentinel identity values (tax ID, email,
  metadata) appear in no preview and no audit summary.
- **LIVE legs:** reject executes through the verified seam on
  LIVE fixtures with zero real provider writes; delete in
  LIVE without the owner grant refuses with zero provider
  writes.

**Baseline accounting.** Against a pristine checkout of
`b55d3ec` (verified by running the new suite in a baseline
worktree on this VM): **31 of 32 tests fail as tool-missing**
(the handlers are absent — `handlers[name] is not a
function` — and the registry totals read 340/166), none as
behavior. The one pass is the guarded-door admission test,
which passes **vacuously** at baseline: its name filter
matches no tools, so the loop body never runs; the substantive
admission proof is the registration test and slice 2's
door loop on the final tree. The guard pins that pass at
baseline for real pass because the machinery already refuses:
the universal door's pinned Connect write classifications
(slice-1 suite, unedited door pins) and the generic
defineWrite contract suite are green at baseline and remain
green here, because this PR does not touch the door or the
machinery.

**Baseline pins updated (4 files, only the baseline records
slice 3 necessarily supersedes; no behavior pin moved):**
`tests/unit/registry.test.js` (exact-name list +3, writes
166 → 169); `tests/unit/profiles.test.js` (home total
340 → 343); the slice-1 suite (registry totals 340/166 →
343/169, and its closing assertion rewritten: where it pinned
that no native write tool covers any slice-3 operation, it now
pins that slice 3 landed — `connect_delete_account` /
`connect_reject_account` / `connect_unreject_account` exist —
with the v2 close's absence recorded in its comment and the
door-classification pins above it untouched); the slice-2
suite (its registration test keeps the eleven lifecycle names
as an exact prefix assertion; totals 340/166 → 343/169).
Slices 1–2 behavior tests are unedited and pass.

**Results on the final tree (this VM, TMPDIR under
`~/workspace`):** full unit suite **213 files / 2,370 tests
passing** (baseline 212 / 2,338; +1 file, +32 tests, all in
the new suite); `npm run check` green (secret scan, docs
check, work-index validation, lint, write-contract checks,
budgets at 19,999/20,000, OpenAPI verify, capability reports,
developer evidence, session check); whole-tree
conflict-marker grep empty.

## Untouched, on purpose

- Slices 1–2 tools: exact behavior (module extended, not
  revised; their suites pass with only the baseline-record
  updates above).
- The `dev-connect-*` TEST substrate simulations.
- The universal door's refusal table and hand-built map:
  D-9 owns the accounts-row flip — its rows for `v1/accounts`
  flip to name Connect slices 1–3 once D-9 lands (the recorded
  expectation, per the Connect card's coordination note; this
  slice does not edit the door).
- Money wiring (`src/tools/write.js`, `src/money.js`,
  `src/db.js`): no change.

## CAP-5 queue addition

Slice-3 acceptance joins the CAP-5 queue: **one ceremony
refusal on the testing surface only** (a `connect_reject_account`
or `connect_delete_account` call on the deployed testing app
whose `confirmAccount` does not repeat the exact connected
account ID refuses before any provider call), against a TEST
platform's test connected account — platform operations on
real connected accounts are never an acceptance probe, per
the Connect card's Done-when.
