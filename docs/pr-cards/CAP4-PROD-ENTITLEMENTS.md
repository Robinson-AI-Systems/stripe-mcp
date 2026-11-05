# CAP4-PROD-ENTITLEMENTS — entitled-product coverage completion (two lists native, two by-id reads blocked on the catalog budget, three v2 imports unserved)

**Status: source-implemented** on branch
`ai/vivienne/cap4-prod-entitlements` from baseline `main`
`c27de60144f754a5c306281c9f1be845f4912f19` (PR #343,
PROD-TAX; the coordinator publishes). Unit
**PROD-ENTITLEMENTS** of CAP-4 Phase 4 (the product-gap
cards), built per `card-product-entitlements.md`. The
frozen card claims **7 operations**: the 4 v1
entitlements GETs and the 3 v2 commerce product-catalog
imports. Every claimed operation carries a build or a
reasoned disposition below; **no native tool is built
and no source file changes**, but the reason is not the
same for all seven rows, and this card states each one
plainly:

- The **two list GETs are already native** (E-2,
  `catalog-extras.js`): `feature_list` serves
  `GET /v1/entitlements/features` and
  `entitlement_list_active` serves
  `GET /v1/entitlements/active_entitlements`, both
  projected and mode-aware. Disposition: native-verified.
- The **two by-id GETs are buildable and warranted on
  the merits, but cannot be built inside this unit's
  binding constraint**: the everyday catalog stands at
  exactly **19,999 / 20,000 tokens with zero headroom**,
  and the leanest honest forms of the two reads —
  measured with the real budget evaluator, as
  `tests/unit/cap4-prod-entitlements.test.js` re-proves
  in-suite — cost **+78 and +84 tokens each**, breaking
  the cap on their own. The standing rule for this
  program is that a new everyday-visible tool fits
  without moving the 20,000 cap and without touching
  other tools' text; neither is available to this unit.
  The builds are therefore **stopped and flagged for a
  coordinator ruling** (see "The budget block" below),
  not silently converted into a door-sufficiency claim.
  Interim service is the guarded universal read, which
  mode-verifies both by-id GETs per-object in both
  modes and both wrong-mode directions (pin-proven in
  this unit's suite).
- The **three v2 commerce import operations are
  unserved** under the fleet v2 rule (coordinator
  ruling 3(iv); PROD-BILLING #341 / PROD-EVENTS #342
  disposition (a) inherited): the pinned catalog at
  this baseline holds 559 operations with **zero `/v2/`
  paths and zero commerce paths** — the operations
  cannot be named by the server's machinery — and the
  consumer search below finds no catalog-import
  consumer anywhere in the tree.

Registry unchanged at **343 tools**; the everyday
catalog stays **19,999 / 20,000**, unmoved. The unit's
deliverables are (1) the seven dispositions with their
evidence; (2) the budget-block proof, re-runnable
in-suite; (3) the re-run area sweep (25 pinned
operations across the four census families, zero
unexamined); and (4) the entitlement-evidence note for
the conformance addendum.

## The seven claimed operations — dispositions

| # | Operation | Disposition |
| --- | --- | --- |
| 1 | `GET /v1/entitlements/features` | **Native-verified** — `feature_list` (E-2) |
| 2 | `GET /v1/entitlements/features/{id}` | **Build blocked on the everyday-catalog budget — flagged for a coordinator ruling**; interim: guarded universal read (mode-verified) |
| 3 | `GET /v1/entitlements/active_entitlements` | **Native-verified** — `entitlement_list_active` (E-2) |
| 4 | `GET /v1/entitlements/active_entitlements/{id}` | **Build blocked on the everyday-catalog budget — flagged for a coordinator ruling**; interim: guarded universal read (mode-verified) |
| 5 | `GET /v2/commerce/product_catalog/imports` | **Unserved** — v2 dispatch rule; no consumer |
| 6 | `GET /v2/commerce/product_catalog/imports/{id}` | **Unserved** — v2 dispatch rule; no consumer |
| 7 | `POST /v2/commerce/product_catalog/imports` | **Unserved** — v2 dispatch rule; no consumer |

## The two native list reads (rows 1 and 3) — verified

Both reads live in `src/tools/catalog-extras.js` (E-2),
registered in `specsRead` with `area: 'catalog'` and
`profiles: allProfiles`. Each projects through the
module's shared `safe()`, which throws unless the
returned object's `object` matches the expected kind
and its boolean `livemode` equals the connection's
mode (`value.livemode!==mode(ctx)`), and shapes the
result to an exact field set:

- `entitlements.feature` → `{id, lookupKey, name,
  active}` (the provider object has exactly seven
  fields in the pinned spec — `active`, `id`,
  `livemode`, `lookup_key`, `metadata`, `name`,
  `object` — so the projection drops only `livemode`,
  `metadata` and `object`).
- `entitlements.active_entitlement` → `{id, feature,
  lookupKey}` (provider object: `feature`, `id`,
  `livemode`, `lookup_key`, `object` — the projection
  drops only `livemode` and `object`).

Mode routing is the catalog family's own idiom:
`catalogClient` (`catalog-mode.js`) serves TEST
through the original client and LIVE only through
`selectedAccountClient`, the owner-enabled,
independently verified LIVE seam — no entitlement
read refuses LIVE categorically, and a wrong-mode
provider object is refused by `safe()` (the E-2
suite's "rejects wrong provider environment for reads
and all previews" leg proves the shared verifier;
this unit's suite pins the exact projected field sets
for both entitlement reads and their wrong-mode
refusal through the registry handlers).
`feature_list_for_product` additionally serves the
product-scoped feature links
(`GET /v1/products/{product}/features`) through its
own verified projection (`linkSafe`).

## The budget block (rows 2 and 4) — stopped, flagged

The frozen card directs a build for each missing
projected read: a by-id feature read under the
catalog family's existing mode idiom, and a by-id
active-entitlement read under the D-series read
idiom. Both are genuinely missing — the registry
holds no `feature_get` and no `entitlement_get_active`
(this unit's suite pins their absence as the current
record) — and both are small, well-precedented
builds: `safe()` already defines both projections,
and the family's write paths already retrieve both
object kinds by id through them
(`feature_attach_to_product`'s read retrieves the
feature; `feature_create`'s read-back retrieves the
created feature).

The block is arithmetic, not judgment. The everyday
catalog budget (`scripts/check-budgets.mjs`, exact
o200k-base counting) stands at **19,999 tokens
against the <20,000 cap — zero headroom**. Adding
the leanest honest form of either read exactly as a
`catalog-extras` `specsRead` entry would register it
(name-derived description, one `sid`-patterned id
argument, `detailFieldsSupported: false`, read-only
annotation) and re-running the real evaluator:

- `feature_get` alone → **20,077 tokens (+78)** —
  fails the cap;
- `entitlement_get_active` alone → **20,083 tokens
  (+84)** — fails the cap;
- both → **20,161 tokens**.

This unit may not move the cap and may not shrink
another tool's text to make room, so the builds stop
here and are **flagged for a coordinator ruling**.
The ruling's options, stated for the record: (a) a
cap decision taken at program level; (b) a
program-owned net-zero reallocation in a unit that
owns the affected tools' text; (c) accepting the
door as the permanent route for these two reads.
Until one is taken, the interim route is the guarded
universal read, and its properties are pinned, not
assumed: `api_read` serves both by-id GETs
mode-matched in TEST and LIVE and refuses a
wrong-mode object in both directions ("Provider
response does not match authenticated account mode")
— per-object mode verification is complete for
single-object reads. Two honest limits of the
interim route, recorded rather than hidden: the
door returns the raw provider shape (for these two
objects the exposure over the native projection is
small and identifier-only — the feature object adds
`livemode`, `metadata` and `object`; the
active-entitlement object adds `livemode` and
`object`; neither object carries PII or any secret),
and a list through the door is not individually
mode-verified per item (the native lists above are
the projected route for enumeration, so the evidence
workflow never needs the door's list shape).

## The v2 commerce imports (rows 5–7) — unserved, consumer search

The disposition inherits the fleet's settled v2
answer (Connect fork 4 / coordinator ruling 3(iv),
adopted verbatim by PROD-BILLING's disposition (a)
and PROD-EVENTS): v2 operations stay unserved until
a v2 dispatch surface is commissioned as its own
unit. Re-verified at this baseline, not copied: the
pinned catalog (`src/stripe/openapi-index.js`)
enumerates **559 operations, zero with a `/v2/` path
and zero with a commerce path** (pin-proven in this
unit's suite); the door's checked request path
accepts only `/v1/` operations, so the three claimed
imports cannot even be named by the machinery.

**Consumer search (the reopening condition —
NOT triggered).** Searched for `commerce`,
`product_catalog/imports`, `EventDestination`-style
import consumers and import tooling across `src/`,
`tests/`, `scripts/`, `docs/` (designs,
implementation guides, acceptance, audits, ROADMAP,
MASTER-ROADMAP, work-index, all JIT cards) and
`.github/workflows/`: the only `commerce` artifact
in the tree is the vendored upstream operations
file (`vendor/stripe-openapi/`) that the census was
derived from; no tool, workflow, design or roadmap
entry consumes or commissions catalog imports. The
v1 `product_catalog` surface that does exist
(trial offers) is a different family, dispositioned
in the sweep below. If a build is ever commissioned,
the frozen card's posture governs: imports are bulk
writes and carry the full write contract with
bounded results and a read-back of the import's own
status object.

## Entitlement evidence note (conformance addendum)

In substance, verbatim as the frozen card requires:
CAP-1's fields mark every operation
`providerVerified: false` — entitlement *evidence*
in the strong sense (provider-proven entitlement
state) is a CAP-5 axis (live proof), not something
this card can mint from source. The addendum line
says exactly that, so "entitled-product gaps closed"
is never misread as "entitlements live-proven."

## The area sweep (re-run at this baseline, final tree)

28 operations examined — the 25 pinned operations
across the four census families (entitlements,
product_catalog, products, prices) plus this card's
3 claimed v2 rows, which exist only in the census
(the pinned catalog cannot name them) — **zero
unexamined**, reconciling with the census appendix:
its PROD-ENT bucket is this card's 7 claimed rows;
its classification bucket's area rows are the 11
writes below (each carries exactly one D-9 row, all
`native-owns` / family `catalog` — pin-proven); its
served bucket's trial-offer GETs land as door-served,
as cross-referenced to D-9/catalog by the frozen
card. Each operation is counted once, under its
family: GETs land Native or Door, writes land D-9,
and the v2 census rows land Out.

| Family | Ops | Native | Door | D-9 | Out |
| --- | ---: | ---: | ---: | ---: | ---: |
| entitlements | 6 | 2 | 2 | 2 | 0 |
| product_catalog (v1 trial offers) | 4 | 0 | 2 | 2 | 0 |
| products | 10 | 4 | 1 | 5 | 0 |
| prices | 5 | 3 | 0 | 2 | 0 |
| v2 commerce imports (census only) | 3 | 0 | 0 | 0 | 3 |
| **Total** | **28** | **9** | **5** | **11** | **3** |

The splits, per family: entitlements' 4 GETs are
the claimed rows (2 native lists, 2 door by-id
reads) and its 2 POSTs are D-9 rows; the v1
product_catalog family's 2 trial-offer GETs are
door-served and its 2 POSTs are D-9 rows; products'
5 GETs split native 4 (`product_list`, `product_get`,
`product_search`, `feature_list_for_product`) /
door 1 (the by-id product-feature link GET,
`/v1/products/{product}/features/{id}` — the link
list is native; the single-link read is door-served
in the link's small raw shape) with 5 D-9 writes
(3 POST, 2 DELETE); prices' 3 GETs are all native
(`price_list`, `price_get`, `price_search`) with
2 D-9 writes. Totals check: 14 GETs = 9 native +
5 door; 11 writes = 11 D-9; 3 v2 rows = 3 out.

Per-row record for the claimed seven is the
dispositions table above. The remaining GETs:
trial-offers list/get — door-served guarded reads
(appendix served bucket; cross-referenced, not
claimed here); products list/get/search and prices
list/get/search — native, mode-aware in the catalog
family (`catalog.js` on `catalog-mode.js`, including
the app-owned metadata posture on `product_get`);
the product-feature link by-id GET — door-served
(the attach/detach writes and the per-product list
are native in E-2).

One observation recorded for the record, outside
this card's claimed scope: `POST
/v1/entitlements/features/{id}` (feature update) is
classified `native-owns` by D-9, and the native
family serves feature create/attach/detach — but no
native feature-update tool exists. The door refuses
the row with the native-owns reason; this card
claims no write rows and builds nothing for it; the
observation stands here so the census record is
never misread as claiming a native update tool.

## Tests and baseline accounting

New suite `tests/unit/cap4-prod-entitlements.test.js`
— **15 tests**: the sweep set (catalog totals, the
exact 25-operation area set, the 11 D-9 rows, the
registered native reads, the by-id absence pin); the
budget facts (everyday exactly 19,999 with no
failures; each lean candidate alone breaking the
cap at the measured totals); the native reads'
exact projected field sets and wrong-mode refusal;
and the door pins for both by-id GETs (serve
mode-matched in TEST and LIVE, refuse wrong-mode in
both directions).

**Baseline accounting: all 15 tests pass at pristine
baseline `c27de601`, by design** — verified by
running the suite in a clean worktree of the
baseline commit. This unit changes no behavior:
there are no behavior failures because the sweep
found no behavior to fix, and the one build the card
directs is stopped on a measured budget fact that
the suite itself re-proves. The pins are named as
pins, not counted as new-behavior evidence (the
PROD-EVENTS / PROD-TAX accounting shape).

## Drift check

Re-derived at this baseline from the pinned catalog
rather than copied from the frozen card (whose
baseline was `19766344`): the claimed 7 rows match
the census appendix's PROD-ENT bucket exactly; the
catalog totals (559 operations, zero `/v2/`) match
PROD-BILLING's and PROD-EVENTS' re-derivations at
their baselines; the area's 25 operations and 11
D-9 rows were enumerated fresh. One drift from the
frozen card's framing, recorded: the card says the
4 GETs "are door-served today in raw provider
shape" — true for the two by-id GETs, but the two
list GETs have been native and projected since E-2;
the dispositions above state the split as found.
No other drift: the v2 inheritance, the D-9
classifications and the registry count (343) all
match the card's cross-references.

## CAP-5 obligation

**No CAP-5 acceptance rows are owed**: nothing in
this unit is built, so there is no new surface to
live-prove. The two blocked by-id builds are not a
CAP-5 row either — they are a flagged coordinator
ruling recorded above and in STATUS; if a future
unit builds them under that ruling, that unit
inherits the D-series CAP-5 obligation by name
(the built reads' LIVE rows). The entitlement-
evidence note stands in the conformance passage:
provider-proven entitlement state remains a CAP-5
axis for the entitlement area as a whole.

## Untouched

All of `src/` is byte-identical to the baseline.
The D-9 classification table, the catalog family's
tools, the universal door, and every other family's
suites are unedited; existing suites' registry and
profile pins stand exactly as they were (343 tools,
everyday 19,999 / 20,000 — the fact this unit's
central disposition rests on).
