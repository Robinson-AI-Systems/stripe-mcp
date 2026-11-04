# OWNER-OBEDIENCE-V2-BRANDING — LIVE brand kit, invoice templates and portal look confirmed-action conversion

Status: **SOURCE-IMPLEMENTED.** Family 11 of 13 of conformance
row 17, conversion **V2** (appendix mechanism 28). This is
corrective work inside the already-merged branding choreography
(H-1); it completes no predefined batch subsection and must not
be counted as one.
Baseline: `main` `d69573f7fe316e0064014663653a81c32123a9cf`
(after PRs #303–#316: V1, the V2 shared machinery, V4, Money,
Disputes, CI speed, Payments, Invoices & credit notes, Billing,
Checkout, Radar, Identity, Files). The branch was then rebased
onto `9c5a865f19ce53e62db926a03028aacff818515b` (PR #317,
Reports) before publication; the shared dispatcher set and the
STATUS / conformance / COMPLETION records interleave both
families, and the full verification was re-run on the rebased
tree. Design draft:
`~/workspace/stripe-v2-design/card-branding.md`; census:
`~/workspace/stripe-v2-design/census.md` Family 12; coordinator
rulings: `~/workspace/stripe-v2-design/coordinator-rulings.md`
(ruling 6 places the family's seventh operation,
`setup_set_payout_schedule`, in Family 1 — it converted in
PR #307 and is out of this card's scope).

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The design card's baseline is current | The card was drafted against `94813299` (pre-V2-shared); the shared machinery it names as future work (preview-fingerprint binding in `src/core/write.js`, the mode-aware client seam) has since landed in PR #304, and Families 1–10 have converted | Built on current `main`; the card's reuse list is satisfied by the merged machinery, not rebuilt |
| Family numbering | The design card and census call this Family 12 (counting the withdrawn customer-monetary item); the merged cards' counting makes it family 11 of 13 | This card follows the merged cards' counting (Branding = 11); the census cross-reference (Family 12) is recorded in the header |
| One dispatcher term admits the family | Area `branding` was in `guardedTestAreas` only, except `setup_set_payout_schedule`, which PR #307 admitted by name (`guardedLiveBrandingWrites`) | `branding` joins `guardedLiveAreas`; the name set stays in place (now subsumed). Delta proven against the registry in the new suite: exactly the six in-scope writes change LIVE admission, the schedule's admission is unchanged, `read_only` still refuses all |
| Removing the two modules' mode terms is sufficient | A further mode gate the census did not enumerate sits in the persistence layer: `saveBrandKit` in `src/brand/store.js` refused any `mode!=='test'` save (the table itself is keyed by account+mode with a `CHECK (mode IN ('test','live'))`, and `getBrandKit` already accepted either mode) | Mode-parameterized to "either valid mode" in the store and mirrored in `test/helpers/fake-db.js` (the Money reservation precedent); the refusal message is mode-parameterized with the TEST wording byte-identical. The DB suite's LIVE-save refusal expectation is reversed by design — see the test note below |
| `brand_preview_checkout` is registered as a write — confirm what it persists before designing its preview (design card build-time verification) | It delegates to `checkout_create_payment_link_for_customer` (converted in Family 6), whose apply creates a real Checkout Session at Stripe (`checkout.sessions.create`) with a hosted URL, verified by read-back | Its write registration is **correct, not a defect**: it persists a provider Checkout session. No registration change; the only conversion needed at this layer was the brand-kit module's TEST account gate in front of it, and the delegate's own preview (mode-labeled, fingerprint-bound, plain-words consequence) is inherited unchanged |
| The brand-kit read inside Checkout hard-codes TEST (census flag) | Already mode-threaded by Family 6: `checkoutPresentation` reads the kit with the connection's mode and demands the brand file's `livemode` equal it | Nothing to build; the new suite proves the separation end to end (a LIVE preview Checkout uses the LIVE kit's color, never the TEST kit's) |
| The portal-look refusal is one gate | Two refusals share the tool: the mode gate and, inside the evaluation, the row 32 ownership refusal — where any app is actively bound, the write refuses *even with* `outsideApp`, because portal ownership cannot be proven from Stripe's data | The mode gate converts. **Row 32 does not**: the block (the `listKnownAppsForAccount` check and its refusal text, including its historical "TEST" wording) is byte-untouched, and the new suite proves it fires in **both** modes with a bound app, even with `outsideApp: true`, with zero provider writes |
| The family's validators accept the shared fingerprint control field | `brand-account.js` validates with the shared `validateFields` (rejects `previewFingerprint` — the Radar species) and `brand_save_kit`'s read validates its key set manually | Family-local resolution (the merged idiom): both `brand-account.js` write reads strip `previewFingerprint` from a shallow copy before validation; `brand_save_kit` admits it in its key set; all six write schemas declare it. The shared `validateFields` is unchanged |
| The guided own-account tools and the template/brand reads convert with the family | They are not writes and are not in the design card's operation list: the six guide tools are `writes: false` honest Dashboard guidance, and `brand_get`, `brand_list_invoice_templates`, `brand_get_invoice_template` are reads | **Not converted.** They keep their TEST-only selectors and verification byte-identically — read reachability belongs to the CAP-4 read work (the Files/Identity precedent). `workflow_brand_business` consumes them and demands TEST state itself (`writable(ctx)`, `state.mode!=='test'`), so the composite gains no LIVE reachability and its TEST behavior is unchanged |
| The payout schedule's converted behavior could drift | PR #307 converted the schedule's handler selector in this same file (`selectedEitherMode`, `makeScheduleWrite()` shared with `money_set_payout_schedule`) | Byte-untouched here; the Money suites (including `money-live-conversion`, which exercises the schedule through both exposures) are re-run green as this family's proof |

## Coordinator rulings, as built

- **Ruling 6 — the payout schedule converts with Family 1.**
  `setup_set_payout_schedule` is excluded from this card (already
  converted, PR #307). This card's area admission sweeps it in only
  in the sense that it was already admitted by name; its handler,
  selector and behavior are untouched and re-proven.
- **Ruling 5 — fingerprint confirmation uniform across modes.**
  The family's previews carry the shared `WRITE-…` fingerprint;
  a confirm presenting it is bound in TEST and LIVE alike; drift
  refuses with a fresh disclosure (proven in LIVE by the template
  drift test). Direct confirms with no preview keep today's
  behavior.

## Build contract, as built

- `src/core/profiles.js`: **`branding` is added to
  `guardedLiveAreas`** — the dispatcher admission this family
  needed, for exactly the six in-scope tools
  (`brand_preview_checkout`, `brand_upload_image`,
  `brand_save_kit`, `brand_archive_invoice_template`,
  `brand_unarchive_invoice_template`, `brand_set_portal_look`)
  plus the already-admitted schedule exposure. Without the
  owner-approved LIVE connection the admission still refuses,
  and `read_only` still refuses everything. None of the six is
  a money tool, so no funding term applies; rows 20–21 are
  untouched.
- `src/tools/brand-account.js`: a mode-aware verifier
  `modeAccount(ctx)` joins `testAccount(ctx)` — the same
  exact-identity proof, with the independent provider mode
  evidence (`readVerifiedTestAccount` / `readVerifiedLiveAccount`)
  demanded for the connection's own mode. The template writes'
  and portal look's `read`/`apply` use it; the evaluated template
  and portal configuration are bound by
  `assertAccountResourceMode`; both `verify` functions refuse a
  read-back whose present `livemode` disagrees with the
  connection's mode (a missing `livemode` keeps the historical
  acceptance, matching the provider fixtures). The three write
  handlers gate on the either-mode selector with mode-neutral
  refusal text. **Not touched:** the row 32 ownership block, the
  public-HTTPS-only URL validation, the owner-configured
  return-destination match, the guided handlers, and the
  template reads.
- `src/tools/brand-kit.js`: a mode-aware verifier
  `verifiedMode(ctx)` joins `verified(ctx)` (which `brand_get`
  keeps, TEST-only). The kit save reads and writes the kit store
  under the connection's own mode — LIVE kits are separate
  records — and demands every referenced brand file's
  `livemode` equal the connection's mode with its purpose exact
  (the brand-asset scope check, unrelaxed). The image upload
  demands the created file's mode equal the connection's mode at
  apply and at read-back verify. The preview-checkout handler's
  account gate follows the mode; the delegate is Family 6's
  converted write, unchanged.
- `src/brand/store.js`: `saveBrandKit` accepts either valid
  mode (above); optimistic revisioning, duplicate no-op and
  account-existence semantics are unchanged in both modes.
  `test/helpers/fake-db.js` mirrors the same term.
- Disclosure: summaries are mode-labeled, with the TEST text
  byte-identical. In LIVE: template archive/unarchive state
  the effect on new real invoices; the portal look names the
  changed fields and states they become publicly visible to
  real customers in the customer portal immediately; the kit
  save states LIVE kits are separate records from TEST kits
  and that future MCP-created hosted pages will show the
  change to real customers; the image upload states the image
  becomes a real business image on the LIVE account that
  hosted Checkout pages, invoices and receipts can show; the
  preview Checkout inherits Family 6's disclosure (a real
  hosted page anyone with the link can pay with a real card).
  Tool descriptions for the six writes are mode-neutral and
  ≤ 160 characters; read/guide descriptions keep their TEST
  wording, which stays true.
- Reused, not rebuilt: the `defineWrite` lifecycle (fresh
  read, app-ownership target guard, preview, `confirm`,
  `rmcp_` idempotency, `recordChange` journal, `verify`
  read-back), the shared preview-fingerprint binding in
  `src/core/write.js`, `authorizeLiveWrite` as the
  LIVE-enablement guard, and `modeClient` (via `client()`)
  for provider resolution.
- Money discipline: branding writes move no money, and
  `src/tools/write.js`, `src/money.js` and `src/db.js` are
  byte-untouched by this card (verifiable in the diff).

## Named tests

- `tests/unit/branding-live-conversion.test.js` — **new, 11
  tests.** Dispatcher admission: exactly the six writes (plus
  the already-admitted schedule) are LIVE-admitted for the
  owner-approved full connection, refused without owner
  approval and for `read_only`, and listed in both modes'
  catalogs. LIVE (owner connection, fake provider + fake
  database): template archive preview discloses the LIVE
  effect, fingerprint confirm archives exactly once with an
  `rmcp_` key, unarchive restores by read-back; a drifted
  confirmation refuses with the fresh fingerprint disclosed
  and nothing executed, and the fresh fingerprint then
  confirms; wrong-mode objects refuse in both directions
  (TEST template on a LIVE connection, LIVE template on a
  TEST-verified connection, LIVE provider evidence on a TEST
  connection); portal look preview names the publicly visible
  fields, confirm re-reads the exact config; **row 32 refuses
  in both modes even with `outsideApp: true`, zero writes**;
  the public-HTTPS and owner-configured return-destination
  checks still fire in LIVE; kit save preview discloses
  separate records, a fabricated fingerprint refuses, the
  real fingerprint saves under the LIVE record only (TEST
  record untouched); the kit asset guard fires in LIVE for a
  wrong-purpose (dispute evidence) file and a wrong-mode file;
  image upload completes in LIVE with verified read-back and
  returns the file ID; preview Checkout mints a verified
  hosted session using the LIVE kit's branding, never the
  TEST kit's.
- `tests/unit/brand-account.test.js`,
  `tests/unit/brand-kit.test.js`,
  `tests/unit/registry.test.js`,
  `tests/unit/workflow-finalization.test.js` — run with
  unchanged expectations, all passing: every pre-existing
  refusal still fires in TEST, including the guided tools'
  cross-mode refusals and the app-owned template guard.
- `tests/unit/profiles.test.js` — **one pre-existing
  expectation updated, recorded here:** the six-area sweep now
  expects every wrapped branding write LIVE-admitted for the
  owner-approved full connection (it previously expected only
  `setup_set_payout_schedule`, per ruling 6). That is exactly
  the admission this card makes; every other expectation in
  the sweep is unchanged.
- `tests/unit/money-live-conversion.test.js`,
  `tests/unit/money-schedule-write.test.js` — re-run green:
  the payout schedule's converted behavior through both
  exposures is byte-identical in behavior after this family.
- `tests/db/brand-kits.test.js` — **one pre-existing
  expectation reversed by design, recorded here:** the suite
  asserted a LIVE kit save rejects; after this conversion it
  succeeds for a registered account as its own account+mode
  record (version 1), and the suite now proves TEST/LIVE
  separation (the other account's TEST record stays null, the
  first account's TEST record is untouched, the final table
  contents carry exactly the two records). Account-mismatch
  and unknown-mode refusals are unchanged. Database proof is
  exact-head CI's route on this machine (no local PostgreSQL
  binaries).
- Full unit suite and `npm run check` on the assembled tree.

## Done when

Met in source: all six operations are admitted in LIVE and
run the full confirmed-action sequence on synthetic fixtures
in tests, with row 32 demonstrably intact in both modes, the
brand-asset scope/mode checks, public-HTTPS validation and
return-destination match demonstrably unrelaxed, the payout
schedule's behavior demonstrably unchanged, and every
pre-existing TEST refusal still firing. Docs updated (this
card, TOOL-CATALOG branding entries, conformance row 17 V2
progress note, COMPLETION, STATUS). No DECISIONS entry was
needed — no new decision arose; the dispositions above are
recorded here. **Live proof remains open** (CAP-5 queue): a
real LIVE branding change happens only when the owner elects
to make one; this family's proof is source/synthetic until
then. No account was enabled, no LIVE key was used, and no
real money moved.
