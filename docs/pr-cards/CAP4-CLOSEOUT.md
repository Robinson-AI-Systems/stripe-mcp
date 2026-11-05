# CAP4-CLOSEOUT — Row 15's capability-completeness addendum + the consumer test

Status: **SOURCE COMPLETE (2026-11-04), pending merge.** The
final CAP-4 unit, per the frozen sequence's "Close of CAP-4"
paragraph: the conformance record's row 15
capability-completeness addendum lands with the final card,
carrying the census reference, D-10's two lines, the Tax
closure line, the ORG disposition line, every product-card
disposition, and the D-3 half-open interval note; and CAP-4's
closing instrument, the consumer test (derivation element 4,
frozen), is built here and runs under CAP-5 against the
finished CAP-4, where it must score zero FAILs — any FAIL
reopens the owning card. Built from main `0a4213cb`.

This is a records-first unit. The only source change is Part
3's one-row refusal-text fix, proven a truthfulness defect
below. The registry stays at 344 tools; the everyday catalog
budget is unmoved at 19,999/20,000; no other tool text
changes.

**Coordinator ruling 11 applied (2026-11-05).** At the
closeout review, after the build, the coordinator ruled
(ruling 11, recorded in the program's coordinator rulings)
that the addendum's capability tally must headline the
strict count, not the re-census reconciliation's counting
convention: two legs that convention counted as
door-covered (entitlements feature update; meter-event
adjustments) are refused under D-9's per-operation
classification table, and the classification of record
wins. The tally statements in this card, the conformance
addendum and its row-15 summary line, COMPLETION and
STATUS were flipped in a follow-on records commit on this
branch: strict headline — covered-native 213,
covered-door 138, composed 2, missing 51, missing-in-LIVE
3, unverified 8, owner-excluded 0 (total 415, covered
351) — with the reconciliation-convention figures
(door 140 / missing 49 / covered 353) retained as the
superseded count, both counts visible. The consumer test
and Part 3 are untouched by the flip; no source files
change.

## Part 1 — The addendum (conformance row 15)

The addendum lands in `docs/RAS-MCP-CONFORMANCE.md` §15,
after the two RECENSUS register updates, as a dated passage:
"**Row 15 capability-completeness addendum — the CAP-4 close
(2026-11-04)**". It carries, in order:

1. **The census reference.** CAP-1's retroactive census (644
   unique GA method/path rows) plus the two-source fleet
   re-census of 2026-11-04 (service map sha256
   `e55b6399…`, server inventory at `2688228f` sha256
   `e2f7d58c…`, reconciled: 415 operations across 104
   objects, every one dispositioned). The two counting units
   are not interchangeable; the tally below is the
   re-census's 415.
2. **The final completeness tally, re-derived** (method and
   movements in the addendum; summary here) — strict
   headline per coordinator ruling 11:
   covered — native **213**, covered — universal door
   **138**, composed **2**, missing **51**, missing in LIVE
   **3**, unverified **8**, owner-excluded **0**; total
   **415** (covered **351**). Movements from the re-census's 200/141/2/61/3/8/0:
   Connect slices 2–3 built 13 of the 14 Phase-2 operations
   (missing −13, native +13); the 14th — connected-account
   session create — was not built and stands re-dispositioned
   by D-9 (refused session-minting class), still missing;
   PROD-PAYMENT's confirmation-token leg moved door → missing
   (deliberately unserved; see item 5); and, per ruling 11,
   the two legs below moved door → missing in the strict
   headline (door −2, missing +2). The server's own
   registration-records register, carried beside the 415 as
   the reconciliation carries it, closes: de-enrollment
   built, OAuth client delete built, OAuth client update a
   recorded deferral (not missing). Qualification, stated in
   the addendum beside the table: the reconciliation-convention
   figures (door 140 / missing 49 / covered 353) are the
   superseded count, recorded in the addendum so both counts
   stay visible; that counting called two legs door-covered —
   feature update and meter-event adjustments — that are
   refused under D-9's per-operation table with recorded
   class dispositions and are claimed as served nowhere in
   the addendum, so under ruling 11 they count as missing in
   the headline, because D-9's classification table is the
   classification of record; the door-covered remainder
   still rests on the reconciliation's policy-class counting
   for legs D-9 did not individually re-serve, and a full
   strict recount of every door-covered leg is the next
   re-census's work under row 15's living duty.
3. **D-10's two decision lines** (dated 2026-11-04, from
   CAP4-PHASE5-ORG-D10): Sigma (S-8) deliberately out of
   build scope — the pinned surface is the two
   scheduled-query-run GETs, door-served; the claimed saved-
   query POST is published-only; authoring has no consumer;
   reopening condition a real consumer or a material
   re-pin. Data Pipeline / bulk export (S-9) deliberately
   out entirely, served beside the server —
   Dashboard-configured warehouse export, zero census rows;
   reopening condition a named consumer.
4. **The Tax closure line, verbatim:** "Tax — no CAP-4 gap
   at the 2026-11-04 census; writes classified in D-9;
   reads natively mode-aware."
5. **Every product-card disposition.** PROD-PAYMENT:
   payment_records native coverage deliberately out,
   door-served, family closed as a unit with D-9's
   refused-third-party rows; mandates door-sufficient;
   confirmation_tokens no native read — and the enumeration
   found the door serving it at baseline (the
   sensitive-family screen's `tokens` pattern can never
   match `confirmation_tokens`), a live privacy defect the
   card fixed by naming the family in the screen; the leg
   is therefore deliberately unserved at the close, which
   is movement M2 of the tally. PROD-BILLING: the 4 v2
   meter-event operations unserved until a v2 dispatch
   surface is commissioned as its own unit (disposition
   (a); the pinned catalog holds zero `/v2/` operations);
   the ingestion rule adopted verbatim from D-9; reads
   native or door-sufficient per path. PROD-EVENTS: all 10
   v2 rows (core event reads + event_destinations)
   unserved under the same disposition (a), inherited per
   ruling 3(iv) and re-proven at that baseline; reopening
   condition the v2 dispatch decision or a consumer needing
   event destinations specifically. PROD-TAX: the closure
   line above; zero CAP-5 rows owed. PROD-ENTITLEMENTS:
   features list/get and active-entitlements list native;
   the two by-id GETs close **door-served /
   native-build-blocked-on-budget / flagged** in ruling 9's
   exact terms (the everyday catalog stands at exactly
   19,999/20,000; the leanest honest builds measure +78 and
   +84 tokens; the cap does not move; reopening conditions
   named in ruling 9) — never as silently covered; the 3 v2
   commerce imports unserved under disposition (a); and the
   entitlement-evidence note, verbatim in substance:
   CAP-1's fields mark every operation
   `providerVerified: false` — entitlement *evidence* in
   the strong sense (provider-proven entitlement state) is
   a CAP-5 axis (live proof), not something the card could
   mint from source; "entitled-product gaps closed" is
   never to be misread as "entitlements live-proven."
6. **The ORG disposition line** (Stage 2a, ruling 10):
   organization context stays outside the server's model,
   by recorded disposition dated 2026-11-04 — an optional
   credential + context layer over the same API, no
   organization resource operations (the census zero is
   structural), no flip fact found; reopening condition a
   named workflow that must operate across two or more of
   the owner's Stripe accounts as one principal through
   this server.
7. **The D-3 half-open interval note:** from PR #304's
   merge until D-3's merge, the invoice/billing/credit-note
   reads executed on LIVE connections through the
   mode-aware seam while their projections did not verify
   returned objects' `livemode` — neither TEST-only nor
   converted (the derivation's A9 finding). Production
   never ran the half-open code. D-3 closed the interval;
   the note stands permanently in the record.
8. **The re-census outcomes:** RECENSUS-1 built
   (enrolled-account de-enrollment under the owner
   ceremony; the register item stops counting as missing);
   RECENSUS-2 built (OAuth client owner visibility +
   delete under the owner ceremony; stops counting as
   missing) with its update leg dispositioned as a
   **recorded deferral** — delete-and-re-register serves
   name/auth-method changes now that the delete leg
   exists; an RFC 7592 read/update endpoint is its own
   future card.
9. **Corrections made visible in the same change:** the
   §15 summary-table line and COMPLETION's row-15 line are
   updated to the re-derived tally (their re-census figures
   contradicted merged cards' outcomes); the reconciliation
   register's item 3 ("Connect lifecycle writes (14
   operations)") is corrected in the movement table — 13
   built, 1 re-dispositioned; its W10 workflow verdict
   ("cannot run") is superseded — account create and
   account-link create exist, so W10 runs; W8 and W12
   remain COMPOSITION-OWED, carried as open items under
   row 15's living duty (they were never CAP-4 scope).
   Row 15 does **not** close: rows close only on live
   proof (row 16, Step 5), and its closing proof's second
   half — the census-citing depth line read live at the
   branded origin — rides the row 8 cutover under CAP-5.
   The grade stands **correctable — PARTIAL under the
   grading amendment**, its count improved: 51 missing and
   3 missing-in-LIVE operations stand (strict headline per
   ruling 11; the superseded reconciliation-convention
   count read 49 missing), every one carrying
   a plan or a recorded disposition in the register
   (reconciliation items 4–16, the D-9 classes, the
   PROD-PAYMENT refusal, the account-session
   re-disposition).

## Part 2 — The consumer test (element 4, frozen shape)

**What element 4 freezes** (its own terms, from
`stripe-cap4-derivation/element4-consumer-test.md`): the
consumer is an agent holding **only** this connection — an
ordinary Full grant, TEST for the build phases, the owner's
LIVE-consented connection for go-live — with no Dashboard
login, no direct Stripe API key, no other Stripe tooling;
anything it cannot do through the connection must be handed
in guided form (exact link, exact clicks, read-back after)
or the test records a "no". Five phases, every step
attempted through the connection first: **A** set the
account up (A1–A6), **B** build the catalog and billing
(B1–B6), **C** wire the application (C1–C4), **D** operate
(D1–D6), **E** go live and stay safe (E1–E5) — 27 steps.
Each step scores exactly one of **PASS** (completed through
the connection, with read-back), **GUIDED** (completed via
the server's guided form, which counts as served),
**NO-DISPOSITIONED** (cannot be done; the record names the
disposition — provider-impossible with evidence /
deliberately out with the ruling / owned by another named
unit), or **FAIL** (a "no" with no disposition, a silent
refusal, a refusal whose reason is wrong, or a success
claim without read-back). "The test **passes as a whole
only with zero FAILs**. PASS/GUIDED/NO-DISPOSITIONED
ratios are reported, never averaged into a score that
could hide a FAIL." The asymmetry: "a step that fails
because a *different* unit owns it … scores
NO-DISPOSITIONED *only if* that unit's own record carries
the step; otherwise it is a FAIL against the schedule."
The run "is executed at a checked release against the
deployed server (CAP-5's discipline), in TEST for A–D and
on the owner's LIVE-consented connection for E".

**What is under-specified in the frozen shape, named, not
invented:** element 4 freezes the step texts, the scoring
vocabulary, the zero-FAIL bar and the execution discipline;
it does not freeze a fixture business's concrete data set
(the Appliance Desk shape "with its names changed to a
disposable fixture business" is directed but the fixture
values are CAP-5's to fix at the checked release), nor a
machine-readable run protocol. This unit implements the
frozen parts only; the CAP-5 card fixes the fixture data
when it runs.

**The instrument as built:**
`tests/helpers/consumer-test.js` carries the frozen step
table (all 27 steps: id, phase, the step's text, its
serving surfaces, its fixture probe kind, its CAP-5
execution class, its owning card) and the frozen scorer
(`scoreStep` / `summarize` implementing the rules above,
including success-without-read-back = FAIL,
wrong-reason = FAIL, and the asymmetry).
`tests/unit/cap4-closeout-consumer-test.test.js` pins the
table against element 4 (27 steps, frozen order, phase
membership, execution classes), proves the scorer on
synthetic evidence, and runs the instrument in fixture
form against this tree.

**Fixture-form results (this tree, baseline `0a4213cb` +
this change), stated in fixture terms — the CAP-5 scores
do not exist yet and none is claimed:** every step's named
surfaces were probed (registered + admitted on the
consumer's Full profile — a missing link would be a
fixture FAIL with its owning card named; none was found).
Verdicts: **5 FIXTURE-PASS** (A1, A6, B6, D2, D6 — the
primary read executed against a fake provider with
read-back), **3 FIXTURE-GUIDED** (A3, A4, C4 — the guided
form resolves: link + clicks + verification, no change
made by the guide), **15 SURFACE-ONLY** (A2, A5, B1–B5,
C1–C3, D3–D5, E4, E5 — links present and admitted; the
end-to-end chain is CAP-5's run), **4 NOT-RUN** (D1, E1,
E2, E3 — LIVE/owner substance only), **0 FIXTURE-FAIL**.
SURFACE-ONLY and NOT-RUN are not passes; they are the
honest boundary of fixture form, and the suite asserts no
CAP-5-only step is dressed as one.

**How CAP-5 executes it live (the execution record):**
- *Deployed server, TEST mode* (`cap5-test`, 20 steps:
  A1–A6, B1–B6, C1, C3, C4, D2–D6): run at the checked
  release against the deployed origin through this
  server's own connection, TEST account, end to end with
  read-back per step; writes run their full guarded
  contract (preview → confirm → audit → read-back).
- *Deployed server, owner's LIVE-consented connection*
  (`cap5-live`, 3 steps: D1, E1, E3): the same tools on
  the owner's LIVE connection; no money moves beyond what
  the owner has separately approved for acceptance; E1's
  parity read must name gaps, never smooth them.
- *Owner's own channel/ceremony* (`cap5-owner`, 4 steps:
  C2, E2, E4, E5): the signing-secret
  hand-off through the one-time channel, the LIVE key
  enrollment + activation ceremony on the owner setup
  page (D7b's per-mode probe is its read-back), pass
  issue/revoke with the revoked-pass refusal proof, and
  disconnect with the token-death read-back (RECENSUS-1's
  de-enrollment is the full-exit form).
- Every NO-DISPOSITIONED the run produces enters the
  census as a finding under row 15's living duty; any
  FAIL reopens the owning card named in the table.

## Part 3 — The feature-update reason text (defect found, fixed)

PROD-ENTITLEMENTS recorded, out of its scope: `POST
/v1/entitlements/features/{id}` is D-9 native-owns to the
catalog family, but no native feature-UPDATE tool exists.
Verified at this baseline by invoking the door: the update
refused, before any provider call, with the shared
native-owns text — "Native-owns: the native catalog family
owns this surface (the catalog family's app-ownership
guard (V3) governs this surface); the universal door keeps
refusing so the native guards are not bypassed" — which
implies a native route a consumer would look for and not
find (the catalog family serves `feature_create` and
`feature_attach_to_product` only). A refusal whose reason
is wrong is the consumer test's own FAIL class; the text
was a truthfulness defect. **Fixed, text-only, one row:**
the update row's reason in
`src/stripe/universal-classification.js` now reads
"Native-owns: this surface belongs to the native catalog
family (the catalog family's app-ownership guard (V3)
governs the catalog surface), but no native feature-update
tool exists — the catalog family serves feature create and
feature attach, not feature update; the universal door
keeps refusing so the native guards are not bypassed, and
the absent native route is recorded here, not implied".
The create row — where the shared text's claim is true —
and every other refusal in the table stay byte-identical,
pinned in the suite. Suite:
`tests/unit/cap4-closeout-feature-update-truth.test.js`
(5 tests; the 2 truthfulness tests fail at pristine
baseline `0a4213cb` as behavior; the surface fact passes;
the 2 byte-identity tests are named PINs, passing at
baseline by design).

## Baseline accounting and verification

- Consumer suite: 14 tests, all passing at pristine
  baseline by design — named as what they are: the table
  and scorer pins, and fixture mechanics run against the
  already-finished CAP-4 tree (the surfaces exist because
  CAP-4 built them; the suite would FAIL, naming the
  owning card, if one vanished).
- Part 3 suite: 2 behavior failures at baseline (above),
  3 passes (1 surface fact, 2 named pins).
- Full unit suite and `npm run check` on the final tree:
  see the STATUS entry for this unit. Database proof for
  this unit is not applicable (no database surface
  changes); the one source change is covered by the unit
  suite and the neighboring door suites (D-9,
  PROD-ENTITLEMENTS) passing unedited.
- Verification ran on this VM (the coordinator's control
  plane) — the location deviation from bench-first is
  declared here per the program's degraded-pass rule; the
  decisive proof is exact-head CI on the published PR.

## What is NOT in this card

- No CAP-5 execution: the consumer test's live run, every
  family's queued live proofs, and row 15's closing proof
  remain CAP-5's.
- No re-census: the door bucket's full strict recount is
  row 15's living-duty work (see the tally qualification).
- No native feature-update tool is built; the absence is
  recorded truthfully, and a build is a future card's
  decision (the catalog family's, under the V3 guard).
- The branded front-door census line (row 8) is untouched.
