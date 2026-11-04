# CAP4-PROD-TAX — Tax-area closure (verification card — the zero, re-proven with evidence)

**Status: source-implemented** on branch
`ai/vivienne/cap4-prod-tax` from baseline `main`
`3185042223247e8805c3a4beae6b265f692e270b` (PR #342,
PROD-EVENTS; the coordinator publishes). Unit
**PROD-TAX** of CAP-4 Phase 4 (the product-gap cards),
built per `card-product-tax.md`. The frozen card claims
**zero census operations, deliberately**, and exists to
close the Tax area with evidence: verify, don't build.
The re-sweep at this baseline **confirms the zero** — no
Tax operation is unbuilt, unclassified or unexamined,
and nothing in this unit changes behavior: **no native
tool is built and no source file changes.** The unit's
deliverables are (1) the re-run area sweep (31 pinned
operations across the four census families, zero
unexamined) with a per-claim verification of the frozen
card's trace; (2) the mode-verification proof for the
native Tax reads — the existing suite's tests cited by
name, plus two gap-fill legs where the suite genuinely
had none; and (3) the closure line for the conformance
addendum. Registry unchanged at 343 tools; the everyday
catalog stays 19,999 / 20,000.

## The closure line (conformance addendum)

**Tax — no CAP-4 gap at the 2026-11-04 census; writes
classified in D-9; reads natively mode-aware.**

## The card's trace, verified claim by claim at this baseline

1. **"Tax reads are already mode-aware native tools
   (`tax-native.js` verifies each object's `livemode`
   against the connection's own mode, built on
   `catalog-mode.js`) — there is no LIVE-refusing Tax
   read."** TRUE, with the sweep's refinement recorded
   below. `src/tools/tax-native.js` registers seven
   reads (`tax_get_settings`, `tax_calculate`,
   `tax_list_registrations`, `tax_list_transactions`,
   `tax_get_transaction`, `tax_list_codes`,
   `tax_get_code`); every one projects through the
   single shared `safe()`, which throws unless the
   returned object's `object` matches the expected kind
   and its boolean `livemode` equals the connection's
   mode (`v.livemode!==mode(ctx)`). `catalog-mode.js`'s
   `catalogMode` accepts both `test` and `live` (no
   mode is refused categorically) and `catalogClient`
   routes LIVE through `selectedAccountClient` — the
   owner-enabled, independently verified LIVE seam — so
   the reads are mode-aware in both directions, not
   TEST-only. (Tax codes are the one shape exception,
   by provider design: Stripe's `tax_code` objects are
   global and carry no `livemode`; `safe()` tolerates
   the absence for that kind only and enforces the
   match whenever the field is present.) Two further
   native Tax reads sit outside `tax-native.js`:
   `taxrate_list` / `taxrate_get`
   (`src/tools/catalog-extras.js`, whose own `safe()`
   requires `value.livemode!==mode(ctx)` to be false —
   i.e. an exact match — and whose handlers are gated
   on `catalogMode`) and `customer_list_tax_ids`
   (`src/tools/customers.js`, projecting through the
   customer family's `verifiedCustomerResource`). The
   remaining 10 of the area's 18 GETs have no native
   read and are door-served (claim 2). So the precise
   statement is: **8 of 18 Tax GETs are native-verified,
   10 are door-served, none refuses LIVE categorically,
   and every single-object read in the area is
   mode-verified on exactly one of the two routes.** The
   appendix's lumped wording ("served by guarded
   universal read and/or mode-aware native reads") is
   the same fact at coarser grain; the per-path split
   is tabulated in the sweep below.
2. **"Tax GETs not natively served are door-served
   guarded reads (appendix, DOOR)."** TRUE, and
   probe-proven at this baseline for two representative
   rows in this unit's suite: `api_read` serves
   `GET /v1/tax/registrations/{id}` and
   `GET /v1/tax_ids/{id}` mode-matched in TEST and LIVE,
   and refuses a wrong-mode object in both directions
   ("Provider response does not match authenticated
   account mode") — the door's per-object mode
   verification is the same behavior PROD-PAYMENT
   pinned for its door rows.
3. **"Registrations are CLASSIFY-AND-ALLOW rows in
   D-9's table."** TRUE: `POST /v1/tax/registrations`
   and `POST /v1/tax/registrations/{id}` are `allow`
   rows (kinds `create` / `update`) in
   `src/stripe/universal-classification.js`. The sweep
   also records the two allow rows the frozen card's
   trace did not enumerate: `POST /v1/tax/settings`
   (`allow`, kind `settings`) and
   `POST /v1/tax/locations` (`allow`, kind `create`) —
   own-account configuration under the existing
   guarded-write contract, consistent with the card's
   "writes are classified, not unbuilt." Native tools
   also serve two of the four allow paths
   (`tax_add_registration`, `tax_update_settings`;
   `tax_end_registration` serves the end case of the
   update path) — allow-at-the-door and native coverage
   coexist exactly as ruling 8 records for the billing
   families.
4. **"Transactions (`create_from_calculation`,
   `create_reversal`) are NATIVE-OWNS rows there (the
   tax-native family owns them)."** TRUE: both rows are
   `native-owns`, family `tax`, and the native tools
   exist — `tax_record_transaction` (calling
   `transactions.createFromCalculation`) and
   `tax_reverse_transaction`
   (`transactions.createReversal`), full write-contract
   tools in `tax-native.js`. The sweep adds the third
   tax-family native-owns row the trace did not
   enumerate: `POST /v1/tax/calculations` is also
   `native-owns` (family `tax`; its reason names the
   calculations transactions are created from as
   financial-record writes), served natively by
   `tax_calculate`.
5. **"Tax_rates are whitelist-baseline rows (already
   working through the door)."** TRUE: both
   `POST /v1/tax_rates` and
   `POST /v1/tax_rates/{tax_rate}` are `allow` rows
   carrying `baseline: true` — D-9's marker for the
   pre-existing whitelist rows, regression-pinned
   byte-identical in D-9's suite. Native
   `taxrate_create` / `taxrate_update` also serve these
   paths (catalog-extras), as with claim 3.
6. **"Customer tax-ID surfaces ride the customer family
   (mode-aware)."** TRUE on both surfaces: the
   customer-scoped writes (`POST` /
   `DELETE /v1/customers/{customer}/tax_ids[/{id}]`)
   and the account-level tax_ids writes (`POST
   /v1/tax_ids`, `DELETE /v1/tax_ids/{id}`) are all
   `native-owns`, family `customer`, in D-9's table,
   and the native tools exist — `customer_add_tax_id`
   and `customer_delete_tax_id`
   (`src/tools/customer-writes.js`, the delete's read
   phase retrieving the tax ID mode-verified) — while
   the customer-scoped list read is the native,
   mode-aware `customer_list_tax_ids`. No `.taxIds.`
   SDK call exists anywhere in `src/`: the account-level
   `GET /v1/tax_ids` and `GET /v1/tax_ids/{id}` are
   door-served (the by-id row is one of this suite's
   two door pins), which is the appendix's disposition
   for them.

**No claim in the frozen card's trace is wrong.** The
two refinements above (the 8/10 native/door split of
the GETs; the allow and native-owns rows the trace did
not enumerate — settings, locations, calculations)
narrow the trace's wording but reverse none of it, so
there is no census amendment to make: the zero stands
as stated.

## Mode-verification proof — existing tests cited, one gap filled

The card's rule: cite the existing suite where it
already proves the property; add the standard
wrong-mode fixture test only for a genuine gap.

Already proven, by name:

- `tests/unit/final-native-e4.test.js` —
  **"rejects wrong provider mode and refuses tax
  calculation based on non-mode matching fixture"**:
  on a TEST connection, a provider fixture with
  `livemode: true` makes `tax_get_settings` error and
  `tax_calculate` error (the calculation provider call
  is made once and its non-matching result refused) —
  the shared `safe()` wrong-mode refusal for the
  tax-native reads. The same file's "Tax settings
  native reads … verified from selected TEST" is the
  mode-matched serve leg, and "isolates concurrent Tax
  registration creation IDs and selected-mode readback"
  proves the registration write's selected-mode
  read-back.
- `tests/unit/catalog-extras.test.js` —
  **"rejects wrong provider environment for reads and
  all previews"** proves the shared catalog-extras
  `safe()` wrong-mode refusal for its reads (exercised
  through `coupon_get`; `taxrate_get` / `taxrate_list`
  run the identical verifier and are exercised
  mode-matched in the same file, with a livemode-flip
  read-back leg on `taxrate_update`).
- `tests/unit/customer-live-authority.test.js` —
  **"reads all eight original customer views in LIVE
  without revealing card secrets"** executes
  `customer_list_tax_ids` on a LIVE connection — the
  customer tax-ID read's LIVE leg.

The one genuine gap: **no test exercised a tax-native
read through the LIVE client route** — the E-4 legs
run on a TEST connection, so the composition of
`catalogClient`'s LIVE branch (`selectedAccountClient`:
production deployment, independently enabled +
connected account, verified LIVE account/balance read)
with tax-native's `safe()` in the LIVE direction was
unproven. This unit fills exactly that gap with two
legs in its suite (`tax_get_settings` serves a
`livemode: true` object on a LIVE connection and
refuses a `livemode: false` one with "did not prove
selected account/mode"). The remaining tax-native
reads (`tax_list_registrations`, `tax_get_transaction`,
`tax_list_transactions`, `tax_list_codes`,
`tax_get_code`) funnel through the same `safe()` the
E-4 test already proves, so per-tool duplicates would
add no evidence; `tax_list_transactions` additionally
verifies every indexed transaction it returns through
that same `safe()` on `tax.transaction`.

## The area sweep (re-run at this baseline, final tree)

Method: every pinned-catalog operation under the four
census families (`/v1/tax`, `/v1/tax_codes`,
`/v1/tax_ids`, `/v1/tax_rates`, plus the
customer-scoped `/v1/customers/{customer}/tax_ids`
rows the appendix files with tax_ids) was enumerated
from `catalog().operations`
(`src/stripe/openapi-index.js`, 559 operations, zero
`/v2/` paths) and classified from current-tree
evidence: a verified native read tool governs its
exact GET path (native-verified), the guarded
universal read serves it (door), or D-9's
classification table governs its POST/DELETE (allow /
native-owns rows, counted D-9). **31 operations
examined, zero unexamined.**

| Family | Ops | Native-verified (GET) | Door (GET) | D-9 allow | D-9 native-owns |
| --- | ---: | ---: | ---: | ---: | ---: |
| tax | 17 | 3 | 7 | 4 | 3 |
| tax_codes | 2 | 2 | 0 | 0 | 0 |
| tax_ids (incl. customer-scoped) | 8 | 1 | 3 | 0 | 4 |
| tax_rates | 4 | 2 | 0 | 2 | 0 |
| **Total** | **31** | **8** | **10** | **6** | **7** |

Per path, with the evidence each row rests on:

| Operation | Class | Evidence |
| --- | --- | --- |
| `GET /v1/tax/settings` | Native-verified | `tax_get_settings` (tax-native.js; `safe()` on `tax.settings`) |
| `POST /v1/tax/settings` | D-9 allow (`settings`) | D-9 table row; native `tax_update_settings` also serves it |
| `POST /v1/tax/calculations` | D-9 native-owns (`tax`) | D-9 table row; served natively by `tax_calculate` (`calculations.create`, result mode-verified by `safe()`) |
| `GET /v1/tax/calculations/{calculation}` | Door | No standalone native get; the retrieve inside `tax_record_transaction`'s read phase is mode-verified, the governed read route for the path is the door |
| `GET /v1/tax/calculations/{calculation}/line_items` | Door | Appendix served bucket; no native tool |
| `GET /v1/tax/associations/find` | Door | Appendix served bucket; no native tool |
| `GET /v1/tax/locations` | Door | Appendix served bucket; no native tool |
| `POST /v1/tax/locations` | D-9 allow (`create`) | D-9 table row |
| `GET /v1/tax/locations/{location}` | Door | Appendix served bucket; no native tool |
| `GET /v1/tax/registrations` | Native-verified | `tax_list_registrations` (`safe()` per item on `tax.registration`) |
| `POST /v1/tax/registrations` | D-9 allow (`create`) | D-9 table row; native `tax_add_registration` also serves it |
| `GET /v1/tax/registrations/{id}` | Door | **Pin-proven in this suite**: serves mode-matched in TEST and LIVE, refuses wrong-mode in both directions |
| `POST /v1/tax/registrations/{id}` | D-9 allow (`update`) | D-9 table row; native `tax_end_registration` serves the end case |
| `GET /v1/tax/transactions/{transaction}` | Native-verified | `tax_get_transaction` (`safe()` on `tax.transaction`) |
| `GET /v1/tax/transactions/{transaction}/line_items` | Door | Appendix served bucket; no native tool |
| `POST /v1/tax/transactions/create_from_calculation` | D-9 native-owns (`tax`) | D-9 table row; served natively by `tax_record_transaction` |
| `POST /v1/tax/transactions/create_reversal` | D-9 native-owns (`tax`) | D-9 table row; served natively by `tax_reverse_transaction` |
| `GET /v1/tax_codes` | Native-verified | `tax_list_codes` (tax codes are global objects with no `livemode`; `safe()` enforces the match whenever the field is present) |
| `GET /v1/tax_codes/{id}` | Native-verified | `tax_get_code`, same posture |
| `GET /v1/tax_ids` | Door | Appendix served bucket; no `.taxIds.` SDK call exists in `src/` |
| `GET /v1/tax_ids/{id}` | Door | **Pin-proven in this suite**: serves mode-matched in TEST and LIVE, refuses wrong-mode in both directions |
| `POST /v1/tax_ids` | D-9 native-owns (`customer`) | D-9 table row; the native route is the customer family's `customer_add_tax_id` |
| `DELETE /v1/tax_ids/{id}` | D-9 native-owns (`customer`) | D-9 table row; native route `customer_delete_tax_id` |
| `GET /v1/customers/{customer}/tax_ids` | Native-verified | `customer_list_tax_ids` (customers.js; `verifiedCustomerResource` mode verification; executed on LIVE in customer-live-authority.test.js) |
| `GET /v1/customers/{customer}/tax_ids/{id}` | Door | Appendix served bucket; the native write's read phase retrieves this path mode-verified, but no standalone native read tool governs it |
| `POST /v1/customers/{customer}/tax_ids` | D-9 native-owns (`customer`) | D-9 table row; served natively by `customer_add_tax_id` |
| `DELETE /v1/customers/{customer}/tax_ids/{id}` | D-9 native-owns (`customer`) | D-9 table row; served natively by `customer_delete_tax_id` |
| `GET /v1/tax_rates` | Native-verified | `taxrate_list` (catalog-extras.js; `safe()` exact livemode match) |
| `GET /v1/tax_rates/{tax_rate}` | Native-verified | `taxrate_get`, same module and verifier |
| `POST /v1/tax_rates` | D-9 allow (`create`, `baseline: true`) | The whitelist baseline row; native `taxrate_create` also serves it |
| `POST /v1/tax_rates/{tax_rate}` | D-9 allow (`update`, `baseline: true`) | The whitelist baseline row; native `taxrate_update` also serves it |

One native read exists beyond the catalog rows, noted
so the table is not misread as the whole Tax surface:
`tax_list_transactions` — Stripe offers no general Tax
transactions list endpoint, so the tool serves the
connector's own recorded index and re-verifies every
returned transaction through `safe()` before
projecting it (its result states the scope plainly:
"only_verified_connector_recorded").

Reconciliation with the census appendix: the
appendix's **served bucket** names all 18 Tax GETs in
its lumped wording — they land here as 8
native-verified + 10 door, the split the wording's
"and/or" carries. Its **line-26 classification rows**
name the 13 Tax POST/DELETE rows — all 13 land here
as D-9-classified (6 allow + 7 native-owns), matching
D-9's table row for row (the D-9 suite's own drift
test already pins table ↔ catalog agreement for every
row). 18 + 13 = 31: the sweep and the appendix agree.

## Tests and baseline accounting

New suite `tests/unit/cap4-prod-tax.test.js`
(12 tests) pins the facts the closure rests on:

- **The sweep-set pins (2):** the pinned catalog's Tax
  area is exactly the 31 operations (18 GETs), and
  every Tax POST/DELETE has exactly one D-9
  classification row.
- **The classification pins (3):** the six allow rows
  with their kinds; the seven native-owns rows with
  their owning families; the two tax_rates rows
  carrying the whitelist `baseline: true` marker.
- **The registry pin (1):** all 19 tax-named native
  tools registered; the registry stands at 343 tools.
- **The door pins (4):** the two representative
  door-served GETs serve mode-matched in TEST and LIVE
  and refuse wrong-mode in both directions.
- **The gap-fill legs (2):** `tax_get_settings` through
  the LIVE client route — serves a LIVE object,
  refuses a TEST object (see the mode-proof section
  for why these two were missing and why no others
  were added).

**Baseline accounting, stated plainly: all 12 pass at
pristine baseline `31850422`, and all 12 are by-design
pins.** This unit changes no source file (verifiable:
the tree's `src/` is byte-identical to the baseline),
so the suite's run on this tree is a run against
baseline behavior; there are no behavior failures to
report, because the sweep found no behavior to fix.
The suite's value is that the closure now rests on
pinned, re-runnable facts rather than prose. Full unit
suite green on the final tree (**218 files / 2,443
tests** — baseline 217 / 2,431 plus this suite's file
and its 12 pins) and `npm run check` green (registry
343 tools, everyday budget 19,999 / 20,000 unmoved).

## Drift check

- **The frozen card's cross-references reproduce at
  this baseline.** Tax reads are mode-aware native
  tools (tax-native.js on catalog-mode.js, verified
  above); the Tax writes sit exactly where the trace
  puts them in D-9's table (registrations allow, the
  transaction creates native-owns, tax_rates whitelist
  baseline); customer tax-ID surfaces ride the
  customer family. The card was baselined at
  `19766344`; D-9, the Connect slices and the three
  earlier Phase 4 cards landed between that baseline
  and this build, and the sweep re-derived every row
  from the current tree rather than inheriting the
  card-era state — the D-9 rows in particular did not
  exist when the card was frozen and are this sweep's
  freshest evidence.
- **No claimed row moved family, because the card
  claims none.** The other Phase 4 cards' claims
  (payment, billing, events, entitlements) are
  untouched; the entitlements card's tax-adjacent
  surface (`taxrate_*` lives in catalog-extras beside
  the entitlement tools) is shared module ground, not
  a claim — this card dispositions the tax_rates rows
  only.

## CAP-5 obligation

**None owed.** Nothing here changes behavior — no
tool, door or classification row is added, removed or
altered — so no live-proof or
disposition-verification row joins the CAP-5 queue
(the frozen card's Done-when, stated explicitly rather
than left silent). Had the sweep forced a build, that
build would have inherited the D-series CAP-5
obligation by name; it did not.

## Untouched

Every source file: no tool, door, classifier, policy or
money-wiring change; D-9's classification table and
card (quoted as evidence, not edited); the tax-native,
catalog-extras and customer families' modules and their
existing suites (cited by name, not duplicated); the
census appendix itself — the sweep confirms its Tax
rows, so there is nothing to amend. Local verification
ran on the coordinator's VM (the standing declared
deviation for this program); no database work in this
unit.
