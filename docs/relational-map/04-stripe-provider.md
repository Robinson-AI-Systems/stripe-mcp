# 04 — The wrapped Stripe provider

## Shape

- `src/stripe/client.js` is the **only production Stripe SDK import**
  (`stripe` 23.0.0, API version pinned `2026-09-30.endive`). It builds
  the client per call from the decrypted enrolled key (see 02),
  checks key↔mode match, caps list pagination (`listAll`, max 1000),
  and derives idempotency keys (see 03).
- `src/stripe/provider.js` dispatches operations behind the tools;
  `src/stripe/money-operations.js` holds the money-out operations
  behind the approval gate.
- **Credential contexts** (`src/stripe/credential-context.js`):
  own-account secret/restricted keys execute directly; **Connect**
  calls run through the platform's verified key with the
  `Stripe-Account` header for the connected account (Connect OAuth
  access tokens are deprecated and are not used as bearers);
  Stripe App OAuth and organization contexts are classified
  `canExecute:false` until separately proven.

## Wrapped surface (tool families in `src/tools/`)

| Stripe area | Tool families (examples) |
|---|---|
| Customers | `customers.js`, `customer-writes.js` |
| Payments | `payments.js`, `payment-writes.js` (PaymentIntents, refunds via dev/money families) |
| Checkout | `checkout.js`, `checkout-writes.js` |
| Catalog | `catalog.js`, `catalog-extras.js`, `catalog-metered.js` (products, prices, metered billing) |
| Billing & subscriptions | `billing.js`, `billing-writes.js`, billing item/schedule writes |
| Invoices & credit notes | `invoices.js`, invoice writes/lifecycle, `creditnotes.js`, credit-note writes |
| Connect | `connect-reads.js`, `connect-writes.js` (connected accounts via `Stripe-Account`) |
| Money | `money-reads.js`, bank reads, payout create/reverse/writes, top-ups, payout schedules — all behind 02's approval gate |
| Disputes & Radar | dispute reads/evidence/submit/accept, `radar-*.js`, file reads, file links, evidence upload |
| Identity | `identity-sessions.js`, `identity-lifecycle.js` |
| Tax | `tax-native.js` (+ `tax_transaction_index` in the store) |
| Reports | `report-reads.js`, report run writes, report result files |
| Events & webhooks | `events-read.js`, webhook reads/writes/create/maintenance/signature (see 06) |
| Account & admin | account profile/capabilities/payment-settings/Apple Pay domains, `admin-*.js`, brand kit/account, app profiles |
| Developer (TEST) | `dev-*.js` — seed, verify, test clocks, simulations, forwarders, cleanup (see 06) |
| Universal | `universal.js` — classified access to the wider GA operation inventory below |
| Server / meta / access | `server.js`, `meta.js`, `access.js`, `summaries.js` |

## Capability evidence (source-only, honestly labelled)

- The vendored GA OpenAPI snapshot (`vendor/stripe-openapi/`, pinned
  `2026-09-30.endive`) records **644 operations: 612 v1 operations + 32 v2 operations**.
  `src/stripe/unified-source.js` / `unified-capability.js` and
  `operation-evidence.js` classify each operation against registered
  handlers and credential contexts; `npm run check:capabilities`
  verifies the inventories offline.
- A classified candidate is **not** provider permission or acceptance:
  entitlement, country and role requirements stay explicitly unknown
  until proven against Stripe (29 provider-acceptance rows remain
  pending — `docs/COMPLETION.md`).
