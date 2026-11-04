# CAP4-PROD-BILLING — billing-area coverage completion (the v2 decision, recorded; meter/alert reads dispositioned)

**Status: source-implemented** on branch
`ai/vivienne/cap4-prod-billing` from baseline `main`
`f008b068e736a05ff6539278dcbb344701fb3c12` (the coordinator
publishes). Unit **PROD-BILLING** of CAP-4 Phase 4 (the
product-gap cards), built per `card-product-billing.md`. As
with PROD-PAYMENT, the honest outcome is a recorded decision
plus verified dispositions, not new tools: **no native tool
is built and no source file changes.** The unit's deliverables
are (1) the v2 meter-event decision, taken with evidence
below; (2) per-path dispositions for every billing-family
GET the earlier sweeps left undecided; (3) the re-run area
sweep (101 operations examined, zero unclassified); and
(4) a pin suite proving the facts the dispositions rest on.
Registry unchanged at 343 tools; the everyday catalog stays
19,999 / 20,000 — also an independent bar to any new
everyday native read in this unit: one token of headroom
admits no tool description, and no other tool's text was
touched to make room.

## The v2 dispatch question — disposition (a): v2 meter events stay unserved

The four claimed operations — `POST /v2/billing/meter_events`,
`POST /v2/billing/meter_event_stream`,
`POST /v2/billing/meter_event_session`,
`POST /v2/billing/meter_event_adjustments` — are
**dispositioned out, unserved, until a v2 dispatch surface is
commissioned as its own unit** (the frozen card's path (a)).
Build path (b) is not taken: no consumer exists by build
time. The evidence, in the order the card demands it be
decided:

- **No dispatch surface exists at all.** The universal door
  resolves every operation from the pinned catalog
  (`src/stripe/openapi-index.js`); at this baseline the
  pinned catalog holds 559 operations and **zero of them are
  `/v2/` paths** (script-derived and test-pinned in this
  unit's suite). The four claimed paths cannot even be named
  by the door. The only `rawRequest` caller in `src/` is the
  door itself, bound to catalog records; no native tool
  speaks a v2 client seam (the two `/v2/` strings in `src/`
  are a credential-context shape validator for published
  operations and a tenancy URL check — neither dispatches a
  provider call).
- **No consumer exists.** The one metering consumer this
  server has — usage ingestion for metered billing — is
  already served natively in v1 by E-3 (PR #274, MERGED):
  `meter_record_usage` reserves the event identifier in a
  durable account-scoped ledger (`src/metered/store.js`,
  `meter_usage_claims`, primary key
  `(stripe_account, mode, identifier)`) *before* ingestion
  and permanently refuses a replayed identifier (mode
  isolation hardened by PR #275). E-3's design record states
  the provider fact for the v1 route: the meter-event create
  response carries the identifier but no retrievable event
  object. No tool, workflow, design or roadmap entry in the
  tree asks for the v2 submission shapes (stream/session);
  `docs/designs/BATCH-E.md` carries no v2 requirement, the
  work-index commissions no v2 dispatch unit, and
  `docs/ROADMAP.md` / `docs/MASTER-ROADMAP.md` carry no
  v2-meter item. A tree search for the v2 operation names
  finds them only in census/classification records.
- **The answer is the program's standing answer.** Ruling
  3(iv): v2 operations are "covered-by-design-decision
  until a v2 dispatch unit exists; the product cards
  (billing/events/entitlements) inherit this answer for
  their v2 rows." The Connect slices applied it identically
  (the v2 close row: "unreachable entirely (no dispatch
  surface)… until a v2 dispatch unit exists"). This card
  inherits it verbatim for the billing v2 rows, so the
  three product surfaces cannot diverge.

The disposition reopens the day a v2 dispatch surface is
commissioned as its own unit or a consumer lands — row 15's
living duty, as with every disposition in this program.

## Ingestion-rule consistency with D-9 — adopted verbatim

The frozen card's coordination rule: the two cards must not
diverge on the ingestion class definition, and the second
to land adopts the first's stated rule verbatim or names
the difference. D-9 landed first (PR #339). Its rule, from
`CAP4-D9-UNIVERSAL-DOOR.md`:

> **Kept refused**, as an explicit ingestion class, citing
> E-3. Meter-event ingestion has no meaningful per-call
> read-back (the provider has no GET for a meter event) and
> its idempotency is by the event's own `identifier`, not
> by request. E-3 (PR #274, merged) already owns this
> surface natively: `meter_record_usage` reserves the
> identifier in a durable account-scoped ledger *before*
> ingestion and refuses replays of a reserved identifier.
> Admitting the raw operation through the generic door
> would offer a strictly weaker idempotency than the native
> route that exists. … `meter_event_adjustments` stands in
> the same class (it rewrites an ingested event by
> identifier; no read-back route exists)…

**This card adopts that rule verbatim — no difference is
named, because none exists.** The v2 meter-event surface is
the same ingestion class under the same definition: no
per-call read-back (no GET for a meter event exists on
either surface, and on this server no v2 surface is
dispatchable at all), and idempotency by the event's own
identifier — which is exactly what the native v1 route's
ledger already enforces. The v2 session/stream receipts
the frozen card's path (b) contemplated are acknowledgment
shapes for a submission path no consumer has asked for;
they do not change the class. One rule now governs meter
ingestion on both surfaces, stated once in D-9's card and
adopted here.

## Meter and alert reads — and the billing-family GETs D-3's sweep did not reach

The frozen card cross-references "the 11 billing-family
GETs, whose native coverage D-3's importer sweep
establishes", and directs: if D-3's sweep found no native
read serving them, they are decided here. The record, from
the current tree:

- **D-3's sweep did not reach these GETs.** D-3 swept the
  importers of the `billing-shared.js` seam and fixed 13
  handlers (invoices, subscriptions, schedules, items,
  credit notes). The meter/alert/credit/feedback GETs do
  not ride that seam. Meter and alert coverage that exists
  natively predates CAP-4: it is **E-3's**
  (`src/tools/catalog-metered.js`, mode-verified
  projections — every projection checks the object's
  `livemode` against the connection mode).
- **Already native (E-3), verified at this baseline:**
  `meter_list` (GET /v1/billing/meters), `meter_get`
  (/{id}), `meter_list_usage_summaries`
  (/{id}/event_summaries), `alert_list`
  (GET /v1/billing/alerts), `credit_list_grants`
  (GET /v1/billing/credit_grants). Meter reads are
  therefore natively covered in full; the alert *list* is
  native.
- **Decided here — door-sufficiency** for each remaining
  billing-family GET, on the mandate precedent
  (PROD-PAYMENT): the guarded universal read serves it, and
  for by-id GETs the door's per-object mode verification is
  complete (test-pinned in both wrong-mode directions for
  the alert, the credit grant and the feedback option, and
  serve-pinned for the rest):
  - `GET /v1/billing/alerts/{id}` — a seven-field config
    object in the pinned spec (`alert_type`, `id`,
    `livemode`, `object`, `status`, `title`,
    `usage_threshold`): no PII, no secret, nothing the
    native list's safe projection withholds in kind. No
    workflow consumes a standalone alert read — the alert
    write handlers retrieve the alert internally under
    write guards. The asymmetry with meters (E-3 built a
    `meter_get`; no `alert_get` exists) is recorded, not
    hidden: it stands because the object is thin config
    the door serves safely, and row 15's living duty
    reopens it the day a consumer appears.
  - `GET /v1/billing/credit_grants/{id}` — the same object
    `credit_list_grants` projects natively (amount,
    category, customer, name, priority, voided_at…);
    the by-id door read is mode-verified, and the native
    list remains the discovery route.
  - `GET /v1/billing/credit_balance_summary` — a
    per-customer aggregate (`balances`, `customer`,
    `customer_account`, `livemode`, `object`; the pinned
    shape requires the `filter` query parameter). It
    carries `livemode`, so the door's mode verification
    applies to it as to any single object. First-party
    account data; no native tool in any family claims it
    (D-1's eight subjects are the account-money reads, a
    different surface).
  - `GET /v1/billing/credit_balance_transactions` and
    `/{id}` — first-party ledger records of credits
    applied (`credit`, `debit`, `credit_grant`, `type`,
    `effective_at`…): the by-id read is mode-verified;
    the list serves under the door's recorded limitation
    (list items are not individually mode-verified — the
    limitation the financial-connections and
    payment-records census rows already carry).
  - `GET /v1/billing/feedback_options` and `/{id}` — a
    six-field config object (`description`, `id`,
    `livemode`, `object`, `status`,
    `status_transitions`); its writes are D-9
    generic-allow, its reads were unclaimed until here.
  - The same decision covers the undecided by-id/list
    GETs elsewhere in the sweep families, each a
    first-party record beside a native sibling:
    `invoice_payments/{invoice_payment}` (the per-invoice
    list is native), `invoiceitems` and
    `invoiceitems/{invoiceitem}` (invoice-scoped lines
    are native through `invoice_get`; the standalone item
    routes were unclaimed), `credit_notes/{credit_note}/lines`
    and `credit_notes/preview/lines` (the notes are
    native), `quotes/{quote}/line_items` and
    `quotes/{quote}/computed_upfront_line_items` (the
    quote is native), `subscription_items/{item}` (the
    per-subscription list is native).
- **One GET is native by design, not door-served:**
  `GET /v1/quotes/{quote}/pdf` returns a binary download,
  which the JSON door cannot project within its result
  budget. E-4 answered the operation deliberately:
  `quote_get_pdf_link` returns the authenticated
  `files.stripe.com` URL for an account-authorized GET —
  never a public URL, never a credential in the address.
  The sweep counts it Native on that design decision.

A native build for any door-sufficient GET above is
additionally unavailable in this unit on the budget fact
in the header (everyday catalog 19,999 / 20,000), exactly
as PROD-PAYMENT recorded for its area.

## The area sweep (re-run at this baseline, final tree)

Method: every pinned-catalog operation under the billing
area (the `/v1/billing/` families; invoices and their
sub-families; subscriptions and their sub-families;
quotes) was re-classified from current-tree evidence —
D-9's classification table governs POST/DELETE where a row
exists (native-owns rows counted Native: the door refuses
or redirects in the native tools' favor; allow and refused
rows counted D-9), the row-35 money classification covers
the seven POST rows with no table entry (the transfer
branch refuses them before the table), verified native
read tools govern their exact GET paths, the door governs
the remaining GETs, and E-4's design decision governs the
quote PDF. **101 operations examined (97 pinned v1 + the
4 claimed v2), zero unclassified.**

| Family | Ops | Native | Door | D-9 | Money (row 35) | Out |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| billing meters & meter events | 9 | 3 | 0 | 6 | 0 | 0 |
| billing alerts | 6 | 1 | 1 | 4 | 0 | 0 |
| billing credit (grants & balances) | 9 | 1 | 4 | 0 | 4 | 0 |
| billing feedback options | 5 | 0 | 2 | 3 | 0 | 0 |
| invoices | 18 | 18 | 0 | 0 | 0 | 0 |
| invoice items | 5 | 3 | 2 | 0 | 0 | 0 |
| invoice payments | 2 | 1 | 1 | 0 | 0 | 0 |
| credit notes | 8 | 3 | 2 | 0 | 3 | 0 |
| invoice rendering templates | 4 | 2 | 0 | 2 | 0 | 0 |
| quotes | 10 | 8 | 2 | 0 | 0 | 0 |
| subscriptions | 10 | 10 | 0 | 0 | 0 | 0 |
| subscription items | 5 | 4 | 1 | 0 | 0 | 0 |
| subscription schedules | 6 | 6 | 0 | 0 | 0 | 0 |
| v2 billing meter events (claimed) | 4 | 0 | 0 | 0 | 0 | 4 |
| **Total** | **101** | **60** | **15** | **15** | **7** | **4** |

Recorded co-existences and refinements, not silently
absorbed:

- **Meters/alerts configuration POSTs are both D-9
  generic-allow and E-3/E-4 native** (meters ×4, alerts
  ×4): the D-9 card records the coexistence and ruling 8
  settles it (the classification of record governs; the
  native shapes are the preferred route). They are counted
  D-9 here, per that classification; the feedback POSTs
  (×3) are door-allow only.
- **Credit-grant POSTs are money-class at the door** —
  all four, including update and expire, which have no
  native tool. Create and void are natively owned by
  E-3's guarded financial writes (`credit_create_grant`,
  `credit_void_grant`); the family's mutation dispositions
  belong to the row-35 money classification and are not
  re-opened here. Credit-note POSTs (×3) stand the same
  way beside V2's native credit-note writes.
- **Meter-event POSTs (v1)** are D-9 refused-ingestion ×2 —
  the rule adopted verbatim above.
- **Invoice rendering template POSTs** (archive/unarchive)
  are D-9 refused-no-readback ×2; their GETs are D-12's
  native brand reads, counted Native.

Reconciliation with the census appendix: the appendix's
D-3 bucket names 27 GET subjects for this area. Per path
at this baseline, **16 land Native** (the E-3 meter/alert/
credit-grant reads, D-3's invoice/subscription/schedule/
item reads, the per-invoice payments list, and invoice
lines folded into `invoice_get`) and **11 land Door** —
the eleven decided in this card (alert by id, credit
grant by id, credit balance summary, credit balance
transactions ×2, feedback options ×2, invoice payment by
id, invoice items ×2, subscription item by id). The
appendix's remaining billing-area buckets reconcile the
same way: PROD-BILL's four rows are the v2 row above;
the billing POST/DELETE rows sit in D-9's bucket and the
OUT-FIN money bucket as the table counts them; the
credit-note GETs the appendix's door bucket names are
natively served on the current tree by D-3's landed
reads and are counted Native here — the sweep governs,
per PROD-PAYMENT's precedent.

## Tests and baseline accounting

New suite `tests/unit/cap4-prod-billing.test.js`
(17 tests) pins the facts the dispositions rest on,
through the real handlers with a fake provider:

- **The v2 pins (3):** the pinned catalog contains no
  `/v2/` operation; none of the four claimed v2
  meter-event paths is in it; `meter_record_usage` (the
  native v1 ingestion route) is registered.
- **The door pins (13):** the alert by id serves in both
  modes and refuses a wrong-mode object in both
  directions; the credit grant by id, the credit balance
  summary (with its pinned `filter` parameter) and the
  feedback option by id each serve mode-matched and
  refuse wrong-mode; the credit balance transaction list
  and by-id reads and the single invoice payment serve
  mode-matched.
- **The registry pin (1):** no native `alert_get`,
  credit-balance or feedback read tool is registered, and
  the native reads the sweep credits (E-3/E-4/D-3/D-12)
  are present.
- **Baseline accounting, stated plainly: all 17 pass at
  pristine baseline `f008b068`, and all 17 are by-design
  pins.** This unit changes no behavior — the v2 surface
  was already undispatched and the gap GETs were already
  door-served — so there are no behavior failures to
  report; the suite's value is that the dispositions now
  rest on pinned, re-runnable facts rather than prose.
  (PROD-PAYMENT's suite had behavior failures only because
  that unit changed the screen; this unit changes
  nothing.) Full unit suite and `npm run check` are green
  on the final tree (registry 343 tools, everyday budget
  19,999 / 20,000 unmoved).

## Drift check

- **The frozen card's D-3 cross-reference does not
  reproduce as stated.** The card (baselined at
  `19766344`) says D-3's importer sweep "establishes" the
  native coverage of "the 11 billing-family GETs". D-3's
  landed sweep covers the `billing-shared.js` seam only;
  it never reached the catalog-mode module where the
  meter/alert reads live, and no single grouping at this
  baseline reproduces the count 11 as "the billing-family
  GETs" (12 GETs sit under `/v1/billing/`; 27 GET
  subjects sit in the appendix's D-3 bucket). The
  discrepancy is naming, not coverage: this card
  dispositions every billing-family GET per path (the
  sweep above), including — by coincidence of the same
  number — exactly 11 door-served GETs among the
  appendix's 27 subjects. Recorded here so no later card
  inherits the miscount.
- **The card's fork is a coordination point, and it
  closed without divergence:** D-9 landed first and
  stated the ingestion rule; this card adopts it verbatim
  (section above). The Connect card's fork 4 answer is
  the same answer. All three surfaces now state one rule.
- **No claimed row moved family.** The four v2 rows were
  PROD-BILL's alone; the v1 rows they touch were D-9's
  and D-3's and are re-derived, not re-claimed. The other
  Phase 4 cards' claims (payment, Tax, events,
  entitlements) are untouched.

## CAP-5 obligation

Nothing was built, so no tool live-proof row is owed. The
dispositions carry one **disposition-verification row**:
on the deployed server at a checked release, the
door-sufficient billing GETs answer through `api_read` on
the owner's connection (alert by id including a
wrong-mode refusal knock, credit grant by id, credit
balance summary), and the four v2 meter-event paths
remain undispatched (no operation exists to call) —
recorded here and in the COMPLETION passage; the
dispositioned rows also join the conformance addendum
through the conformance passage in this PR.

## Untouched

Every source file: no tool, door, classifier, policy or
money-wiring change (`src/tools/write.js`, `src/money.js`,
`src/db.js` and the D-9 table are byte-identical); D-9's and
D-3's merged cards (the ingestion rule is adopted by
quotation here, not edited there); V2's billing write
conversions. Local verification ran on the coordinator's
VM (the standing declared deviation for this program); no
database work in this unit.
