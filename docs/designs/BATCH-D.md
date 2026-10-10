# Design — Batch D: Everyday money (customers, payments, refunds, checkout, subscriptions, invoices)

Status: **APPROVED** (Chris, 2026-10-10, IN-00). Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch D.
Cards D-1 … D-5. Depends on Batches B and C. Tool list: `docs/TOOL-CATALOG.md` sections Customers; Payments and refunds;
Checkout, payment links and the customer portal; Subscriptions; Invoices, credit notes and quotes (invoices and credit
notes here; quotes in Batch E).

"Port" means: take the matching tool in `Robinson-AI-Systems/robinsons-toolkit-mcp` `handlers/stripe.js` only as a
reminder of which Stripe call it makes; rebuild with the official library through `src/stripe/client.js`. Never copy its
`encode()` or `fetch` wrapper.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| D1 | At the pinned version, the invoice preview is `POST /v1/invoices/create_preview` and `/v1/invoices/upcoming` does not exist | `node scripts/openapi-find.mjs "invoice preview"` |
| D2 | Subscription billing periods live on items (`items.data[].current_period_end`), not on the subscription | `node scripts/openapi-find.mjs "subscription item"`; read the schema fields |
| D3 | Cancel-at-period-end is an update (`cancel_at_period_end` on `POST /v1/subscriptions/{id}`), not a parameter of the cancel endpoint | same tool |
| D4 | Checkout `branding_settings` exists on session create (used once Batch H saves a kit) | same tool |

## 1. Decisions

**D1. No `client_secret` ever leaves the server.** Saving a card or bank account is a hosted Checkout page in `setup`
mode (`checkout_create_setup_link`, card + US bank account); paying is a hosted Checkout page or the hosted invoice page.
The toolkit's `stripe_onboard_customer`, `stripe_create_setup_intent` and raw `create/confirm_payment_intent` are not
rebuilt.

**D2. Charging a saved method off-session** (`payment_charge_saved_method`) requires a description and the customer's
default payment method; it is `$` (always confirm, daily limit).

**D3. Refunds read the charge first** and refuse an amount above the refundable remainder, in words.

**D4. Subscriptions:** periods from items; cancel-at-period-end by update, reversed by `billing_undo_cancel`; plan changes
preview the exact amount with `create_preview` before applying; `billing_mode` and `proration_behavior` are always stated
explicitly in requests (as the Appliance Desk app does) so an account default can never change what customers pay.

**D5. Invoices:** `invoice_mark_paid_outside_stripe` uses `paid_out_of_band`; on an app-owned invoice the app guard refuses
and names the app's own "Record payment" screen.

**D6. Old-name map.** D-1 adds `docs/TOOLKIT-NAME-MAP.md`: every old toolkit Stripe tool name → new name, or "removed,
because …" (from the audit). Agents used to the toolkit can find their way.

## 4. Work units (each: unit tests, write-contract for every write, stripe-mock for every call, TOOL-CATALOG marks)

### D-1 — Customers (M) — includes `customer_find` (plain search that picks Stripe's search syntax) and the name map
### D-2 — Payments, charges, refunds, setup intents (M, medium effort)
### D-3 — Checkout, payment links, portal (M)
Extra: no result contains a `client_secret`; setup links offer card and US bank account.
### D-4 — Subscriptions and schedules (L, medium effort)
Extra: regression tests for audit bugs 1, 3, 4 and 5 (preview endpoint, item periods, nested items, period-end cancel).
### D-5 — Invoices and credit notes (L, medium effort)

## 5. Stop-and-ask points

1. Any D0 row false: amend before that card.
2. A Stripe call the catalog names does not exist at the pinned version: drop the tool, record it, point
   `stripe_where_is_setting` or Batch U at it.

## 6. Acceptance mapping

| PLAN Batch D line | Evidence |
|---|---|
| Every listed tool built, catalog marked | TOOL-CATALOG Origin column `built #n` |
| No secrets in results | key-scan test + D-3 assertion |
| Audit bugs 1, 3, 4, 5 cannot recur | D-4 regression tests |

## Amendments
