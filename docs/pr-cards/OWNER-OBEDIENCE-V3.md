# JIT card — OWNER-OBEDIENCE-V3 (catalog `outsideApp` categorical ban)

Status: **SOURCE-IMPLEMENTED on `ai/vivienne/owner-obedience-v3-catalog`,
live proof open.** This converts the last of the four convertible
vetoes in row 17's refusal census: the catalog family's categorical
refusal of the owner's explicit `outsideApp` acknowledgment. After
this card, all four conversions (V1–V4) stand source-implemented;
every one of them closes only on live proof in the CAP-5 queue
(checked release, exact-head evidence). Nothing in this card enables
an account, proves LIVE behavior, or closes row 17.

Design record: `~/workspace/stripe-v34-design/card-v3.md` (Lane B,
independent derivation, verified against the tree at that card's
baseline) with the coordinator's six rulings in
`~/workspace/stripe-v34-design/coordinator-rulings.md`. The rulings
govern wherever the design card is silent; the design card's own
rulings stand otherwise.

## What is wrong today

The owner's standing rule: a known app-owned catalog record may be
changed outside its owning app only when the owner explicitly
acknowledges it (`outsideApp: true`) — the route the general
app-ownership guard offers on every denial it produces. The catalog
family refuses the acknowledgment itself, in three stacked layers:

1. `outsideApp` is absent from the seven E-1 write schemas, and the
   `read` hook's `checkArgs` allowlist does not admit it — passing it
   is an argument error before ownership is even evaluated.
2. The `read` hook throws for a known app-owned target (directly, or
   via a price's parent product) even when the flag is present.
3. The `targetGuard` in `src/tools/catalog.js` refuses any
   `outsideApp: true` categorically with `'App-owned catalog override
   not permitted'`.

The refusal of a write whose ownership is **unclear** is row 30's aim
check, not a veto, and does not convert.

## Drift check (baseline `94813299` → tree `19766344`, 2026-11-04)

The design card's line map still holds at the new baseline. Five
disagreements, additions, or confirmations found while building:

1. **A FOURTH refusal the design card's map did not enumerate — LEFT
   AS BUILT, OPEN POINT / RESUME NOTE.** `price_create`'s `read`
   hook also refuses when the exact lookup key resolves to an
   EXISTING price whose ownership is known app-owned **or**
   unclear: `'Existing lookup key belongs to an app-owned or
   uncertain price'`. History: introduced by E-1 fix `795c367`
   ("refuse reuse of lookup keys already owned by another app"); it
   predates the design card's baseline, so Lane C's three-layer map
   predates nothing — it simply missed a live refusal. It guards a
   distinct record (the existing price) whose marker is not the
   ceremony's evaluated marker, and converting it would improvise
   around a guard the card did not map. It is left byte-identical
   pending a coordinator ruling. Practical effect until then:
   `price_create` that would reuse an existing app-owned price with
   identical terms still refuses even through the ceremony
   (unchanged from today); the ceremony covers `price_create` onto
   an app-owned **product** (fresh lookup key), which is the card's
   named case and is fully covered by tests. Everything else in
   this card is implemented and verified; this point does not block
   the conversion's named scope.
2. **Post-card machinery (PR #304).** The core write contract now
   carries a caller-presented `previewFingerprint`; the design
   card's five fingerprint exclusions predate it. The override
   fingerprint helper excludes `previewFingerprint` alongside the
   card's five (`dryRun`, `confirm`, `requestKey`, `outsideApp`,
   `outsideAppFingerprint`) — it is a confirmation artifact exactly
   like `confirm`, and including it would make any confirm that
   presents both fingerprints refuse itself. No weakening of the
   guard: the binding digest still covers account, mode, tool,
   target, marker, and every change argument.
3. **The `scope.warning` summarize sentence.** It asserts "this
   independent record is not an app-owned record" whenever any
   bound app owns its own catalog. That was unreachable-false
   before (app-owned records never reached `summarize`); after the
   conversion an app-owned record can, and the sentence would
   contradict the ceremony's own disclosure. The warning now fires
   only when no override marker was evaluated. Disclosure
   correctness, inherent to the conversion.
4. **A third E-1 test of the named species.** The design card names
   two E-1 tests that assert read-hook throw shape and must move
   to guard-refusal shape; the LIVE cross-account test
   (`prod_BASE123` re-marked with `agreementId: 'agr_APP'`) is the
   same species and received the identical reshape, for the
   identical reason, with its provider-not-called assertion
   unchanged.
5. **`price_create`'s `before` record carries the product.**
   Verified: the composed guard in `src/tools/write.js` therefore
   resolves the product's ownership before the catalog
   `targetGuard` runs, so layer 3 is the only place the
   `price_create` split (ruling 1) is load-bearing — in `read` the
   product check throws only for unclear ownership, and in the
   `targetGuard` the belt-and-braces line returns an aim-check
   refusal only for unclear ownership and falls through for a
   known marker into the ceremony.

## Build contract (as built)

Scope: `src/tools/catalog.js` (the seven product/price writes),
`src/tools/app-guard.js` (one pure helper),
`tests/unit/catalog.test.js`. `src/core/write.js`,
`src/tools/write.js`, `src/money.js`, and `src/db.js` are
byte-untouched; by ruling 3 the fresh fingerprint rides the
guard-refusal `reason` string, so the shared write pipeline did
not move.

- **Surface.** The seven write schemas gain `outsideApp` and
  `outsideAppFingerprint` (a strict `APP-…` pattern), and the
  `read` hook's `checkArgs` allowlist admits both
  (`outsideAppFingerprint` is `safeText`-validated and excluded
  from the explicit-mutable-field check, so the fingerprint alone
  never counts as a change). No read tool admits either argument;
  no other tool family gains `outsideAppFingerprint`.
- **Known vs unclear.** The `read` hook evaluates ownership
  exactly where it did before (target; a price's parent product;
  `price_create`'s product). Unclear ownership throws the same
  aim-check refusal as today, unchanged. A known marker is
  stashed per invocation for the guard and the summary: a price's
  own marker governs, else its parent product's; the target's own
  marker governs before a parent fallback.
- **Disclosure.** For an app-owned target the journaled preview
  summary states the owning application's name, the evaluated
  record and agreement, the recommended in-app screen, and the
  judgment in plain words — the record belongs to the named app,
  changing it outside the app can desynchronize its billing and
  affect its live behavior — plus the override fingerprint. The
  disclosure is part of the journaled record, not new journaling.
- **Fingerprint.** `appOverrideFingerprint` (new, in
  `src/tools/app-guard.js`, mirroring the V1 helper
  `liveEnableFingerprint`): SHA-256 over a canonical state binding
  account, mode, tool, target, the full marker (app ID, key,
  value, agreement ID, via, record ID) and the canonicalized
  change arguments; rendered `APP-XXXXX-…` in five groups. The
  digest never contains the marker value or agreement ID verbatim.
- **Ceremony.** `targetGuard`: no evaluated marker → ordinary
  write (flag inert; on `product_create` an accepted no-op,
  ruling 4). Marker + no flag → the standing `appOwnedDenial`
  text, unchanged. Marker + flag, not a confirm → pass; the
  preview carries the fingerprint. Marker + flag + confirm →
  recompute the fingerprint from this invocation's freshly read
  marker and arguments and compare in constant time
  (`secretsMatch`); a missing or mismatched fingerprint is refused
  as a guard refusal whose reason states the state moved or was
  never confirmed and carries the **fresh** fingerprint. Marker
  removed between preview and confirm → no marker at execution;
  the write proceeds as an ordinary write (ruling 2). Marker
  changed → different fingerprint → refused, no write. Confirm
  succeeds at most once per fingerprint state; the provider write
  executes exactly once and the fingerprint is in the journaled
  summary of the non-dry-run record.
- **Default path.** Without the flag, app-owned targets refuse
  exactly as today (same denial text, same guard-refusal shape
  the composed guard already produced); non-app-owned targets are
  untouched; the rental-app refund exception and every other
  existing guard exception are untouched.

### The six coordinator rulings, as implemented

1. **`price_create` target-guard line splits.** In `read`, the
   product check throws only for unclear ownership; in the
   `targetGuard`, the pre-existing belt-and-braces line returns
   `'Price product ownership is not clear'` only for unclear
   ownership and falls through for a known marker. No other guard
   line changes character.
2. **Marker removed between preview and confirm → ordinary
   write.** The confirm re-evaluates ownership fresh in `read`;
   with no marker there is nothing to acknowledge, and the
   presented fingerprint is inert. Covered by a named test.
3. **Fingerprint rides the refusal `reason` string.**
   `src/core/write.js` is untouched; the guard refusal returns
   the fresh fingerprint inside its reason text, the same
   contract every guard refusal already uses.
4. **`outsideApp` on `product_create` is an accepted no-op.**
   No prior owner exists; the marker stash is always null for a
   create, so the guard passes and the create proceeds normally.
   Covered by a named test.
5. **Standard preview → fingerprint → confirm machinery** (the
   PR #304 shape); no V4-style statelessness. The confirm step
   re-reads and re-evaluates before comparing.
6. **No live fixtures built.** The live-proof obligations below
   are recorded against CAP-5's existing disposable app-marked
   catalog product fixture.

## Named tests

`tests/unit/catalog.test.js`:

- Three E-1 assertions reshaped (throw → parsed guard refusal;
  reason names the app, record, and agreement; provider-not-called
  assertions unchanged): `price_create` onto `prod_OWNED123`;
  `price_update` whose parent product is app-owned; the LIVE
  `product_update` on a re-marked `prod_BASE123`. No other
  existing assertion weakened.
- New `owner-obedience V3 catalog outsideApp conversion` suite
  (12 tests): no-acknowledgment refusal for a product and for a
  self-owned price (denial names app, record, screen);
  acknowledgment without fingerprint refuses and carries the fresh
  fingerprint; happy path — preview names app, record, judgment
  text, and fingerprint format; confirm executes the provider
  write exactly once; the non-dry-run audit row's summary contains
  the fingerprint; marker changed → refused with a different fresh
  fingerprint and no write; marker removed → proceeds as ordinary;
  wrong-target and wrong-change fingerprints refused;
  `price_create` ceremony — fingerprint confirm creates and reads
  back the price, stale fingerprint after the marker moves refused
  with `prices.create` never called; unclear ownership refuses
  with `outsideApp` and any fingerprint exactly as today;
  `product_create` flag no-op and unowned-target flag no-op;
  flag scoping — the seven writes declare both arguments, catalog
  read tools declare neither, no non-catalog tool declares
  `outsideAppFingerprint`, and `product_get` with `outsideApp`
  refuses as an unsupported field. Helper tests: stability across
  argument key order, sensitivity to account/mode/tool/target/
  app/marker key/marker value/agreement ID/record/any change
  argument, confirmation-artifact exclusion, format, and the
  marker value / agreement ID never appearing verbatim in the
  fingerprint.

## Acceptance — what would prove this wrong

- **No-flag path moved.** Any catalog test showing different
  outcomes for app-owned, non-app-owned, or unknown-ownership
  targets without `outsideApp: true` than before this change.
- **Ceremony bypass.** A confirm that writes without the exact
  fresh fingerprint for the current marker state and change —
  including a fingerprint minted for another target, another
  change, another app, or a stale marker.
- **Unclear ownership softened.** Any path where an unclear-owner
  target proceeds, or refuses with anything other than today's
  aim-check refusal, with or without the flag.
- **Scope leak.** Any read tool or non-catalog write accepting
  `outsideApp`/`outsideAppFingerprint`, or any change to
  `src/core/write.js`, `src/tools/write.js`, `src/money.js`, or
  `src/db.js` in this card's diff.
- **Disclosure gap.** A journaled preview for an app-owned target
  that does not name the owning app/marker and state the
  live-behavior judgment, or a completed override whose audit
  record lacks the fingerprint.

## Live proof left open (CAP-5 queue)

Against CAP-5's disposable app-marked catalog product fixture, at
a checked release, each of these is observed live before this
conversion counts as closed:

- A preview for the fixture product names the product, its owning
  app and marker, and the exact previewed change, and carries a
  well-formed `APP-…` fingerprint.
- A confirm presenting that fingerprint executes the provider
  write exactly once, reads the changed record back, and leaves
  the fingerprint in the journaled audit record.
- A confirm without the fingerprint, or with a fingerprint minted
  for a different change, is refused and writes nothing; the
  refusal carries the fresh fingerprint.
- The same writes without `outsideApp: true` refuse with the
  standing app-ownership denial, exactly as before this change.
- A target whose ownership cannot be resolved refuses as an aim
  check, with or without the flag.
- Marker drift is exercised where the fixture permits it: a
  marker changed between preview and confirm refuses; a marker
  removed between preview and confirm lets the write proceed as
  an ordinary write.

No live fixture was created or touched by this card (ruling 6);
these obligations join the CAP-5 queue against the fixture that
already exists there.

## Records

- `docs/DECISIONS.md`: **no entry.** The predecessor conversions
  added none; the six coordinator rulings were given before the
  build, so no new decision was needed; and the one open point
  above (the unmapped existing-lookup-key refusal) is a deferral
  awaiting a coordinator ruling, not a decision taken here.
- This card is not registered in `docs/pr-cards/work-index.json`,
  following the established precedent for the owner-obedience JIT
  cards.
- Governing records updated with this card: `docs/STATUS.md`
  (top entry), `docs/RAS-MCP-CONFORMANCE.md` row 17 (V3 bullet),
  `docs/COMPLETION.md` row 17 and its closing summary,
  `docs/OWNER-GUIDE.md` (the catalog note that stated the ban
  outright), and `docs/ARCHITECTURE.md` §B-3 (one dated sentence;
  the section's general statement is unchanged).
## Coordinator ruling (2026-11-04) — the fourth refusal stays, as its own follow-up

The existing-price lookup-key refusal in `price_create`'s read hook ("Existing lookup key belongs to an app-owned or uncertain price", E-1 fix `795c367`, predating the card's baseline) is NOT split by this conversion and stays byte-identical. Two grounds. (1) Its uncertain-ownership half is an aim check by the same principle as ruling 1: unclear ownership refuses, full stop. (2) Its known-ownership half guards a DISTINCT record — the existing price — whose marker is not the target this ceremony evaluates; extending the fingerprint ceremony to bind a second record is a design step of its own, and doing it inside this PR would improvise around an unmapped guard. Practical scope stands as built: the ceremony covers `price_create` onto an app-owned product with a fresh lookup key (the card's named case); replaying an existing app-owned price's lookup key remains refused. The follow-up is a named open item — a V3-b card to design the two-record ceremony if the owner ever needs that replay path — recorded here and in the conformance note, not silently absorbed into this conversion.
