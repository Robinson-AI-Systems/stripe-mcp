# CAP4-D3-INVOICE-BILLING-READS — invoice, billing and credit-note reads verify in the connection's mode; the A9 half-open state closes

Status: **SOURCE-IMPLEMENTED.** Family D-3 of CAP-4 (the first
CAP-4 family built, sequenced first by coordinator ruling 1 because
it closes a verified defect). Read paths only: no write handler's
mode gate, ceremony or verification moves, and the money wiring
(`src/core/write.js`, `src/money.js`, `src/db.js`) is byte-untouched.
Baseline: `main` `f3dc460b9dd00607c45130ec2780e67e2d52e795`
(PR #320, owner-obedience V3). Design record: the CAP-4 derivation
and card set (`card-billing-reads.md`, `census.md`, `sequence.md`,
`coordinator-rulings.md` ruling 1) in the coordinator's design
folder; the family's write side is OWNER-OBEDIENCE-V2-INVOICES and
OWNER-OBEDIENCE-V2-BILLING.

## The defect this card closes (A9)

PR #304's shared seam swap replaced the TEST-only client helpers
with `modeClient(ctx)` (`src/tools/account-mode.js`), so the read
handlers behind `guarded` in `src/tools/billing-shared.js` began
executing on LIVE connections — but the handlers' own object
verification was never converted. At baseline:

- `src/tools/invoices.js` contained **zero** `livemode` checks:
  `invoice_list`, `invoice_get`, `invoice_search`,
  `invoice_list_payments` and `invoice_preview` projected whatever
  the provider returned, in either mode.
- `src/tools/billing.js` passed the connection mode only into
  discount verification (`subscriptionSafe`/`itemSafe`), never
  verifying the subscription's or item's own mode; the schedule
  projections (`scheduleSafe`) took no mode at all.
- The derivation's probe result stands as the baseline proof: a
  `livemode:false` object projected without complaint on a LIVE
  connection. These reads were therefore **neither TEST-only nor
  converted** — the derivation's rejected Option 3 state, arrived at
  accidentally. This card's new suite reproduces the defect as
  tests: at baseline, 22 of its 31 tests fail, every failure a
  wrong-mode or TEST-wording assertion below; after this build all
  31 pass.
- **The half-open interval is PR #304's merge → this card's merge.**
  Production never ran the half-open code: the deployed build
  (`c95f9cf0`) predates PR #304, and `main` was not promoted while
  the interval stood (coordinator ruling 1's promotion guard). The
  conformance record states the interval in the same words.

## Drift check

| Assumption | Actual at baseline | Resolution |
| --- | --- | --- |
| The derivation census names `invoice_list_lines` and `invoice_list_payment_attempts` as separate tools | The registry folds lines into `invoice_get` (via `invoices.listLineItems`) and the payments tool is `invoice_list_payments` | Naming drift, not a scope change; this card uses the registry names throughout |
| The defect is the two named handlers (`invoice_list`, `billing_list_subscriptions`) | The sweep below found the same unverified-projection class in **13 handlers across 3 modules**, including a second module the seam reaches only through shared projections (`creditnotes.js` via `safeCredit`) | All 13 are in scope per ruling 1 and fixed here; the sweep table is the completeness proof |
| List handling for a wrong-mode member: filter or refuse | The card is silent; the family's reference implementation (`billing_preview_change`, V2) refuses the whole evaluation on a mode mismatch via `assertAccountResourceMode`, and discount semantics (sentinel, never throw) are the family's one established exception | **Whole-response refusal** for verified objects: any wrong-mode member fails the read with `Stripe provider resource mode mismatch`. Discounts keep their established sentinel semantics untouched. Recorded here as the build's one interpretation |
| `billing_preview_change` needs conversion | It already asserts the subscription and the price against the connection mode and passes `{mode}` into `previewChange` (V2, family 5) | It is this card's reference implementation; untouched |
| `creditnote_preview` needs conversion | It already passes the connection mode into `creditPreflight`, which asserts the invoice and the preview (PR #311) | Untouched; only its TEST-worded description is corrected |
| `safeCredit` can simply gain a required mode | `creditPreflight` calls `safeCredit(preview)` on the write path after its own mode asserts, and the write fixtures carry no `livemode` | `safeCredit` takes an **optional** mode, exactly the `discountSafe` precedent: supplied mode verifies, no mode is byte-identical historical behavior. `creditPreflight` internals are untouched |
| `invoicePreviewReadSafe`'s error text "Stripe TEST USD preview unavailable" must be de-TESTed with the descriptions | The string fires only on malformed or non-USD preview data, in either mode; changing it would alter established TEST behavior and error precedence | **Retained** as historical wording, recorded here; the tool descriptions (the behavior callers read) are all corrected |
| An item's expanded price needs no verification | A wrong-mode expanded price object on a verified item would project its terms into a read | `itemSafe` verifies an expanded price object when a mode is supplied (a string price ID carries no mode and is not checked). Named in the tests |
| CAP-4's work-index entry still names a placeholder card | `docs/pr-cards/work-index.json` CAP-4 points at `docs/pr-cards/CAP-4.md` (absent by design under `WRITE_CARD_AT_START`) with status `APPROVED` | The unit has started: the entry now names this card and reads `IN_PROGRESS`. Family cards that follow register the same way when they land; acceptance units are unchanged |
| A decision entry is expected if behavior choices arise | The whole-response choice and the price verification are implementation interpretations of the card, recorded in this drift table | No `docs/DECISIONS.md` entry, per the V2-BILLING precedent |

## The sweep — every read handler reachable through the shared seam

Method: every importer of `client`/`guarded` from
`src/tools/billing-shared.js`, plus every module sharing the D-3
projections, was read at baseline and dispositioned. Handlers
reachable through the seam are exactly those behind `guarded` /
`modeClient`.

**Defect — unverified projection, fixed in this build (13 handlers):**

| Module | Handlers | Baseline state |
| --- | --- | --- |
| `invoices.js` | `invoice_list`, `invoice_get`, `invoice_search`, `invoice_list_payments`, `invoice_preview` | No `livemode` check anywhere in the module |
| `billing.js` | `billing_list_subscriptions`, `billing_get_subscription`, `billing_search_subscriptions`, `billing_list_items` | Mode reached discount verification only; the subscription's/item's own mode never checked |
| `billing.js` | `billing_list_schedules`, `billing_get_schedule` | `scheduleSafe` took no mode at all |
| `creditnotes.js` | `creditnote_list`, `creditnote_get` | `safeCredit` had no mode check and no mode gate |

**Already verified at baseline (reference implementations, untouched):**
`billing_preview_change` (asserts subscription + price, `{mode}`
into `previewChange`); `creditnote_preview` (mode into
`creditPreflight`, PR #311).

**Refuse LIVE by their own gate — not half-open; owned by the named
later CAP-4 family:** money reads (`money-reads.js`,
`money-bank-reads.js` — D-1); dispute and event reads
(`dispute-reads.js`, `events-read.js` — D-4); report, file and radar
reads (`report-reads.js`, `report-result-file.js`, `file-reads.js`,
`radar-reads.js` — D-6); account and admin reads
(`account-capabilities.js`, `account-profile.js`, `admin-fees.js`,
`admin-overview.js`, `admin-security.js`, `admin-guided.js` via
`requireAdminTestAccount` — D-7); identity reads
(`identity-sessions.js` — D-11); brand reads (`brand-account.js`,
`brand-kit.js` TEST-only selectors — D-12); workflow composites
(`workflow-customers.js`, `workflow-money-snapshot.js`,
`workflow-dispute-kit.js` route through `workflow-read-common.js`'s
TEST-only `verifyContext` — D-8); `app-profiles.js` reads
(`accountOk` requires TEST — dispositioned out of CAP-4 to the
Projects owner-surface migration, coordinator ruling 4);
`testclocks.js` and the `dev-*.js` read paths (TEST substrate;
developer context cannot exist at LIVE).

**Already mode-aware, not seam-reachable:** catalog reads and
`catalog-extras.js` (`catalog-mode.js` factory); webhook reads
(`webhook-mode.js`); `tax-native.js` (verifies `livemode` against
its own mode helper); `account-apple-pay-domains.js` and
`account-payment-settings.js` (required-mode asserts);
`project-setup.js` provider paths (`safePortal` checks `livemode`;
its one read tool, `project_draft_profile`, is a local transform of
caller-supplied findings and makes no provider call).

**Not read surfaces:** `universal.js` (imports helpers only; its
own door — D-9); `quote-native.js` and `workflow-month-close-find.js`
(no read tools).

## Build contract, as built

- `src/tools/billing-shared.js` — `subscriptionSafe(sub, mode)` and
  `itemSafe(item, mode)` now verify the object's own `livemode` via
  `assertAccountResourceMode` when the mode is `test`/`live`
  (`itemSafe` also verifies an expanded price object);
  `scheduleSafe(v, mode)` gains the optional mode parameter with the
  same rule. No-mode behavior is byte-identical, including discount
  sentinel semantics.
- `src/tools/billing.js` — the two schedule handlers pass
  `c?.connection?.mode` into `scheduleSafe`. Nothing else changes;
  `billing_preview_change` is untouched.
- `src/tools/invoices.js` — `safeInvoice(v, mode)` gains the
  optional mode verification; `invoice_list`, `invoice_get` and
  `invoice_search` pass the connection mode; `invoice_get` also
  verifies the retrieved invoice before fetching its lines;
  `invoice_list_payments` verifies the retrieved invoice and passes
  the mode to `invoicePaymentSafe`; `invoice_preview` verifies the
  retrieved customer and passes the mode to
  `invoicePreviewReadSafe`. The five descriptions and the module
  header no longer claim TEST.
- `src/tools/invoice-read-safety.js` — `invoicePaymentSafe(payment,
  invoiceId, mode)` and `invoicePreviewReadSafe(invoice, customerId,
  mode)` gain the optional mode verification after their historical
  shape checks (error precedence unchanged).
- `src/tools/creditnote-shared.js` — `safeCredit(v, mode)` gains
  the optional mode verification after its historical shape checks;
  `creditPreflight` and every write path are untouched.
- `src/tools/creditnotes.js` — `creditnote_list` and
  `creditnote_get` pass the connection mode; the three descriptions
  and the module header no longer claim TEST.
- Verification semantics: a returned object whose present boolean
  `livemode` disagrees with the connection mode refuses the whole
  read (`Stripe provider resource mode mismatch`); an object with
  no `livemode` field passes, exactly `assertAccountResourceMode`'s
  established non-required semantics (the write fixtures rely on
  it). Wrong-mode is refused in **both** directions.
- No dispatcher, profile, registry or reachability change: the same
  322 tools, the same profiles; reads that executed at baseline
  execute now, verified. No SQL, no schema, no Stripe operation
  added or removed.

## Named tests

New suite `tests/unit/cap4-d3-reads.test.js` (31 tests):

- **Invoices:** LIVE list/get/search/preview happy paths returning
  verified live objects with unchanged field sets (`invoice_list`
  TEST output key set asserted exactly); wrong-mode refusal in both
  directions for list, get, search, the payments read's invoice and
  its payments, and the preview; `safeInvoice` mode/no-mode
  contract; the five descriptions carry no TEST claim.
- **Billing:** wrong-mode refusal in both directions for
  subscriptions list/get, search, items list (including an item
  whose expanded price is wrong-mode), schedules list/get; LIVE
  happy paths for each; the shared-projection contract (mode
  verifies, no mode is historical).
- **Credit notes:** wrong-mode refusal in both directions for list
  and get; LIVE/TEST happy paths; the `safeCredit` mode/no-mode
  contract including a no-`livemode` fixture; the three descriptions
  carry no TEST claim.
- **Baseline record:** 22 of the 31 fail at baseline `f3dc460b`
  (every wrong-mode, projection-contract and description test); the
  9 mode-correct happy-path and shape tests pass at baseline and
  after, proving TEST behavior and field sets did not move.
- **Regressions standing:** the full pre-existing unit suite passes
  unchanged — in particular `billing-live-conversion` (discount
  verification matrix), `billing-write-contract`,
  `invoices-live-conversion`, `creditnote-contract`,
  `invoice-write-contract`, `mode-client`, the workflow composite
  suites and `registry` (322 tools).

Database tests are exact-head CI's route: this build environment
has no local PostgreSQL binaries (`session:prepare` reports
`localPostgresBinaries: false`), and no database code changes here.

## Acceptance

- A read on a LIVE connection never projects an object whose
  `livemode` disagrees with the connection, in any of the 13 swept
  handlers; the same holds in reverse on a TEST connection.
- Every pre-existing read expectation stands; TEST output shapes
  are byte-identical (asserted for `invoice_list`; the rest are
  covered by the unchanged pre-existing suites).
- **Live proof stays open in the CAP-5 queue:** on the owner's own
  LIVE connection after a checked release — LIVE invoice list/get,
  subscription list/get and credit-note list reads returning
  verified live objects, and a wrong-mode-object knock test (a TEST
  object presented to a LIVE read is refused). This card claims
  source implementation only.
- The conformance record's CAP-4 progress note and the half-open
  interval record land with this card; COMPLETION's CAP-4 section
  records D-3 as the family's first landed unit.

## Done when

- The 13 handlers verify, the sweep is filed (above), the new suite
  and the full unit suite pass, `npm run check` is green, and the
  docs named in this card are updated. The successor inherits:
  D-1 (money reads) next in the frozen Phase 1 sequence; the
  promotion guard on `main` lifts when this card merges.
