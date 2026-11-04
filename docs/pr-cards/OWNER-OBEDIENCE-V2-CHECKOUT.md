# OWNER-OBEDIENCE V2 — CHECKOUT (family 6)

Status: **SOURCE-IMPLEMENTED 2026-11-04; live proof remains open in the CAP-5
queue.** This card converts the hosted checkout, payment-link and customer-
portal write family from TEST-only to the connection's mode under conversion
V2 (conformance row 17, convertible veto V3's hosted-surface half). It
completes no predefined batch subsection in `docs/pr-cards/README.md` — the
README keeps its existing V2 row until the coordinator's closeout, as with the
Money, Disputes, Payments, Invoices and Billing cards.

## Scope

Nine tools in `src/tools/checkout-writes.js`:
`checkout_create_payment_link_for_customer`, `checkout_create_setup_link`,
`checkout_expire`, `paylink_create`, `paylink_update`, `paylink_deactivate`,
`paylink_activate`, `portal_create_session`, `portal_update_configuration`.

These tools create and change payment *surfaces*: a hosted checkout page, a
payment link, or a customer-portal session/configuration. No money moves
through this module — a charge happens only when a person pays on Stripe's
hosted page, under the existing contracts. No money wiring
(`src/tools/write.js`, `src/money.js`, `src/db.js`) is touched.

## Baseline and drift check

Design baseline: current `main` after PRs #303–#311 (V1, the V2 shared
machinery, V4, Money, Disputes, CI speed, Payments, Invoices); the branch was
rebased onto PR #312 (Billing, family 5) before landing, as the coordinator's
brief requires when main moves during a build. The design card
(`card-checkout.md`, written against `94813299`) and the census were checked
against that baseline before editing. Material drift found and resolved:

| Design-card assumption | Baseline truth | Resolution |
| --- | --- | --- |
| `getStripe` (checkout-writes.js :42-45) throws on `mode !== 'test'` and must be parameterised from `customer-mode.js`, and `previewFingerprint` must be stripped before confirmation | PR #304 already deleted `getStripe`; the wrapper builds `modeClient(connection)` from `src/tools/account-mode.js`, the validator strips `previewFingerprint`, and the schemas declare it | No seam or fingerprint work remained. The conversion is the wrapper gate, mode invariants, two hidden mode gates (below), summaries and descriptions |
| The wrapper and the registry were the only gates | Two more mode gates sat inside the tools: (1) `checkout_expire`'s `sessionId` schema pattern admitted only `cs_test_` ids, refusing every LIVE session id at argument validation; (2) `checkoutPresentation` read the brand kit with a hardcoded `mode: 'test'` and refused any uploaded brand file with `livemode === true`, so a properly branded LIVE link could never preview | Pattern widened to `cs_(test|live)_…` with the retrieved object's mode invariant binding it; the brand-kit read now takes the connection's mode and the file check compares `file.livemode` against it |
| `beforeFor`/`verify` needed their `livemode` comparisons parameterised | Like Payments, they had none at all: no evaluated object (customer, price, portal configuration, session, payment link) and no read-back was ever checked against the connection's mode | Added: every read in `beforeFor`/`readAfter` is wrapped in `assertAccountResourceMode`, and `verify` now refuses a read-back whose `livemode` disagrees with the connection mode. Both directions are proven by test |
| LIVE fixtures extend `tests/unit/checkout.test.js` | That file is the D-3 hosted *readers* suite (1,179 lines); the write suite is `tests/unit/checkout-write-contract.test.js` (76 tests) | Followed the Payments precedent: a new `tests/unit/checkout-live-conversion.test.js` carries the LIVE proof; the contract suite's expectations are unchanged |
| The mock suite to extend is `tests/mock/checkout-write-contract.test.js` | The real mock suite is `tests/mock/checkout.test.js` (D-3, TEST mode, stripe-mock). The apply payloads are mode-independent and are already asserted by the unit suites; local PostgreSQL/stripe-mock proof is not available on this machine | Mock and DB proof are exact-head CI's route, as with Payments |
| The contract suite's bare-LIVE expectation must be rewritten | `checkout-write-contract.test.js` asserts LIVE dispatch throws, without naming the refusal text | Assertions unchanged: a bare LIVE connection is still refused before any write — now by the LIVE-enablement guard ("LIVE changes are not enabled…") instead of the TEST-only wrapper gate |
| The mode-client seam suite's checkout expectation survives | PR #304's `tests/unit/mode-client.test.js` asserts checkout's wrapper refusal by name ("TEST-only hosted operation"), scoped by its own header "until their family conversions" | Retired exactly as the brief directs: the checkout half now expects the LIVE-enablement guard's refusal (same outcome — a bare, non-enabled LIVE connection executes nothing), and the header records both the Payments and Checkout conversions. The seam expectations are untouched |
| `docs/TOOL-CATALOG.md` checkout entries state the TEST-only condition | They state no mode condition at all | Catalog unchanged |
| A decision entry is needed | None was: every choice above is a drift resolution inside the recorded V2 design | `docs/DECISIONS.md` unchanged |

## Build contract (as built)

- **Wrapper admission unchanged.** The brief shape, catalog-gated dispatch,
  preview/apply code hashes, idempotency keys, journal, intent/target guards,
  app-ownership target guard and the guarded-write pipeline are exactly as
  before. The registry already lists `checkout` in the guarded-live areas
  (PR #304); `src/core/profiles.js` is untouched.
- **Wrapper gate removed.** The
  `if (ctx?.connection?.mode !== 'test') return gone('TEST-only hosted operation')`
  refusal is deleted. Under a LIVE connection the guarded-write pipeline's
  existing rules decide: `full` profile only, catalog listing, customer
  context, a live-enabled and live-connected account, owner-approved LIVE,
  and a binding preview fingerprint. A bare LIVE connection is refused by the
  LIVE-enablement guard before anything executes.
- **The hosted-URL aim check is NOT relaxed.** After a create, the created
  object's `url` is surfaced in the result only when `hosted()` verifies it
  is a Stripe-hosted URL; a non-Stripe URL leaves the write unconfirmed
  (`done:false`, `confirmed:false`, no URL surfaced). No unverified URL is
  ever presented as the customer's page.
- **Mode invariants, both directions.** Every object the preview evaluates —
  customer, price, portal configuration, checkout session, payment link — and
  every read-back is asserted with `assertAccountResourceMode` against the
  connection's mode; `verify` additionally refuses a read-back whose
  `livemode` disagrees. A TEST object under a LIVE connection, or a LIVE
  object under a TEST connection, stops the call before any write.
- **Brand kit follows the connection.** `checkoutPresentation` reads the
  account's brand kit in the connection's mode and accepts the uploaded brand
  image only when the file's `livemode` matches that mode.
- **Verified facts still gate the write.** The active-price requirement, the
  portal feature read-back (`portal_update_configuration` verifies each
  requested feature against the provider's own read-back), the hosted-URL
  verification and the existing per-tool aim checks (URL allowlists, feature
  enumeration, app-ownership target) are all unchanged.
- **Disclosure.** Every tool description is mode-neutral and ≤ 160
  characters. Summaries open with `LIVE MODE. ` or `TEST MODE. `, state the
  plain-words consequence from the verified preview, keep the destructive
  marking where it existed, and end with the read-back instruction:
  - payment-link creation: "Anyone with this link can pay **$X.XX** at the
    verified active price" — in LIVE, "with a real card" — plus "Creating the
    link charges nobody by itself."
  - setup link: no money is charged and no client secret is involved.
  - expire: "The hosted page for this session stops accepting payment."
  - deactivate: "The link stops accepting new payments; past payments are
    unaffected."
  - portal session: the customer can use the powers the verified
    configuration grants.
  - portal configuration update: each granted or removed customer power is
    enumerated from the verified read-back facts, including "customers CAN
    cancel their own subscriptions" when that power is on.
- **Money discipline.** No money wiring is touched. Checkout tools create
  payment surfaces; any actual charge flows through Stripe's hosted page and
  the existing contracts, never through this module.

## Named tests

- `tests/unit/checkout-live-conversion.test.js` (**new, 11 tests**): LIVE
  preview→confirm happy paths on a fake provider and fake DB for
  `paylink_create` (disclosure names the real-card consequence and the price;
  fingerprint issued; exactly one provider write; the Stripe-hosted URL is
  surfaced), `checkout_create_payment_link_for_customer` (verified-price
  disclosure), `checkout_create_setup_link` ("No money is charged"),
  `checkout_expire` on a `cs_live_` session id, the
  `paylink_update`/`paylink_deactivate`/`paylink_activate` loop,
  `portal_create_session`, and `portal_update_configuration` (preview names
  the subscription-cancellation power); fingerprint drift refusal (the price
  changes after preview → the apply is refused, a fresh fingerprint is
  disclosed, zero provider writes; the fresh fingerprint then confirms); a
  TEST price under a LIVE connection refused at read time with zero writes;
  a LIVE price under a TEST connection refused the other way; and a created
  object whose URL is not Stripe-hosted left unconfirmed with no URL
  surfaced (the aim check unrelaxed).
- `tests/unit/checkout-write-contract.test.js` (76 tests, expectations
  unchanged): the TEST-mode briefs, payloads, read-backs, and every
  pre-existing refusal — read-only, bare-LIVE (now refused by the enablement
  guard), batch, wrong fingerprint, inactive price, non-hosted URL, URL
  allowlist, and the portal feature read-back checks.
- `tests/unit/mode-client.test.js` (6 tests): seam behavior unchanged;
  checkout's refusal expectation updated to the LIVE-enablement guard and the
  header records the Payments and Checkout conversions (see drift table).
- `tests/unit/checkout.test.js` (D-3 readers, 2 tests) and
  `tests/unit/brand-kit.test.js` (7 tests) pass unchanged.
- Full unit suite and `npm run check` green on the final tree; the
  conflict-marker grep is empty and `git diff --check` is clean. DB and mock
  suites are exact-head CI's route on this machine.

## Done when / acceptance

- [x] All nine tools preview and confirm in both modes under the existing
  guarded-write rules, with mode invariants on every evaluated object and
  read-back, in both directions.
- [x] The TEST-only wrapper gate, the `cs_test`-only session-id pattern and
  the TEST-hardcoded brand-kit read are gone; the hosted-URL aim check, the
  verified-active-price requirement and the portal feature read-back are
  unrelaxed.
- [x] Summaries are mode-labeled and state the plain-words consequence,
  including what a live payment link does and what deactivating one does.
- [x] No money wiring touched; `src/core/profiles.js` untouched; no caller
  outside this family changed reachability (the profiles registry test is
  the instrument and passes).
- [ ] Live proof: a real LIVE payment link minted, paid/not-paid state read
  back, and deactivated under an owner-approved LIVE connection — **left
  open in the CAP-5 queue; no real payment link was minted for this card.**
  Source implementation is not live acceptance.
