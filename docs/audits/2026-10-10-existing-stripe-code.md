# Audit: existing Stripe code across Chris's repos (2026-10-10)

Reference evidence, not instructions. Where it names old card IDs (P2-4, P5-7 …), the current batches are in
`docs/MASTER-ROADMAP.md`; the profile work is Batch P, workflows Batch W.

Audited 2026-10-10 by reading the code in every repository Chris has access to.
File paths are relative to each repository.

## Where Stripe code lives today

| Repository | What it holds | State |
| --- | --- | --- |
| `robinsons-toolkit-mcp` | `handlers/stripe.js` (1,121 lines, 202 tools) and `registry/stripe.json` | The current, working version. Runs locally. The main source for this plan's tool list. |
| `robinsons-toolkit-mcp` | `handlers/compound.js` | Seven compound tools call Stripe (`compound_provision_tenant`, `compound_tenant_upgrade`, `compound_complete_job`, the weekly report, cost audit and others). |
| `robinsons-toolkit-mcp` | `EXPANSION_ROADMAP.md`, `EXPANSION_QUICK_GUIDE.md`, `ClaudeBuildPlan.md` | The **planned** Stripe work: dispute evidence and chargebacks, webhook event filtering and signature checking, billing cycle and invoice customization, financial reports, team/permissions and audit logs, payout scheduling, underwriting status, `stripe_issue_refund_and_cancel` with a confirmation email hook, churn rate. |
| `robinsonai-mcp-servers` | `packages/robinsons-toolkit-mcp/src/categories/stripe/` (TypeScript, 150 tools, published to npm as v1.7.0) | The older generation. Superseded. Useful for a few things the current version dropped (below). |
| `robinsonai-mcp-servers` | `standalone/experimental/stripe-mcp/` (TypeScript, ~110 tools) | An earlier standalone attempt. Has dispute evidence submission, dispute file upload and webhook signature checking, which the current toolkit lacks. |
| `robinsons-toolkit-api` | `api/handlers/stripe.js` | A stub: every call throws "not yet implemented". Ignore. |
| `appliance-desk` | `src/lib/stripe.ts`, `src/domains/billing/*`, `src/app/api/webhooks/stripe/route.ts` | **The real Stripe user.** The rental app's billing runs on Stripe (test mode). This MCP must work alongside it, not against it. |

## What the rental app does with Stripe (so this server can help, not collide)

From `appliance-desk` (`docs/BUSINESS-RULES.md`, `docs/ARCHITECTURE.md`, code):

- Uses the official `stripe` Node library (v22). Calls: customers (create,
  retrieve, search, balance credits), Checkout sessions (deposit and
  signing payments, ACH included), Subscriptions (create at delivery, update,
  cancel, search), refunds, payment intents, setup intents, charges, invoices,
  invoice payments, the Billing Portal, tax rates, products.
- Tags its Stripe records with its own IDs in `metadata`: `agreementId`,
  `estimateId`, `depositId`, `invoiceId`, `refundId`, `creditId`,
  `rentalLineId`, `customerId`, `sessionId`, `kind`, `rdf_record_id`,
  `rdf_payload_hash`.
- Its webhook is the *only* thing allowed to mark money as paid in its
  database. It listens for `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `invoice.paid`,
  `invoice.payment_failed`, `charge.refunded` and
  `customer.subscription.deleted`.
- **Open item for Chris:** the two `async_payment_*` events still need adding
  to the webhook endpoint in the Stripe dashboard (ACH deposits are not
  confirmed until they are). The new server's `workflow_webhook_health` (P5-7)
  finds and fixes exactly this in one sentence.
- Every Stripe write the app makes uses a fixed idempotency key and is tracked
  as a `ProviderOperation`; a "drift workbench" lists mismatches between the
  app and Stripe. A refund made directly in Stripe is recognised and settles
  correctly; most other direct edits to app-made subscriptions or customers
  would show up as drift. Hence the app-owned guard (ARCHITECTURE.md).
- Stripe stays in **test mode** until Chris explicitly authorizes live.

## Bugs in the current toolkit Stripe code (verified)

These are real, not theoretical. Each was checked against the code; the first
three are caused by Stripe's 2025-03-31 ("Basil") API version, which removed or
moved the fields the code relies on. Whether a call fails today depends on the
API version set as the default on Chris's Stripe account, because the toolkit
does not pin one.

| # | Where | What goes wrong |
| --- | --- | --- |
| 1 | `stripe_get_upcoming_invoice`, and the preview step of `stripe_upgrade_subscription` | Call `GET /v1/invoices/upcoming`, which Stripe removed. The replacement is `POST /v1/invoices/create_preview`. |
| 2 | `stripe_create_usage_record`, `stripe_list_usage_record_summaries` | Legacy metered-usage records were removed; usage now goes through Billing Meters (which the toolkit also has). These two should not exist. |
| 3 | `stripe_dunning_check`, `stripe_upgrade_subscription`, `stripe_customer_billing_summary` | Read `subscription.current_period_end`, which moved to each subscription *item*. On current versions the dates come back as "Invalid Date". |
| 4 | `encode()` in `handlers/stripe.js` | A list of objects is sent as the text `[object Object]`. Verified: `{ items: [{ price: 'price_A', quantity: 2 }] }` is sent as `items[0]=%5Bobject%20Object%5D`. So creating a subscription with an `items` list, and any other tool given a list of objects, fails. |
| 5 | `stripe_cancel_subscription` with `at_period_end: true`, and `stripe_cancel_and_refund_customer` | Sends `cancel_at_period_end` to the *cancel* endpoint, which does not take it. "Cancel at the end of the period" is done by *updating* the subscription. As written it either errors or cancels straight away. |
| 6 | `stripe_get_mrr_summary`, `stripe_revenue_summary` | MRR ignores quantity, `interval_count` (every 3 months counted as monthly), discounts, tiered and metered prices, and trialing subscriptions; reads only the first 100 subscriptions; adds different currencies together. "Revenue last 30 days" sums only the **last 10 charges** (`limit: 10`), not 30 days. |
| 7 | `stripe_onboard_customer` | Returns a SetupIntent `client_secret` into the chat. That secret belongs in a browser, not a conversation. The safe pattern is a hosted Checkout page in "setup" mode, returned as a link. |
| 8 | Every write | No idempotency key, so a network retry can charge, refund or pay out twice. No read-back. No confirmation. Only two Stripe tools have entries in `inverses.js`. |
| 9 | `stripe_list_radar_rules` and three siblings | Call `/v1/radar/rules`. No such endpoint appears in Stripe's published API reference (Radar exposes value lists, reviews and early fraud warnings; rules are managed in the dashboard). Card P4-4 must confirm against the reference and, if absent, drop them and point to the dashboard instead. |
| 10 | Errors | Raw `Stripe 400: ...` text; no help for a declined card, a missing permission on a restricted key, or a test/live mix-up ("No such customer ... a similar object exists in live mode"). |

## Things the older versions had that the current one lost

Worth bringing back (all included in TOOL-CATALOG.md):

- Dispute evidence submission and evidence-file upload (`stripe_dispute_evidence_submit`, `stripe_dispute_file_upload`).
- Webhook signature checking (`stripe_webhook_construct_event`) — useful to test the app's webhook secret.
- Search for prices, products, subscriptions, payment intents and charges (Stripe's Search API).
- Refund update and cancel; invoice update and delete-draft; subscription item add and remove; promotion code lookup by code; remove a customer's discount.

## Planned Stripe work found in the roadmaps, and where it lands

| Planned item (source) | Where in this plan |
| --- | --- |
| Chargeback/dispute evidence (EXPANSION_ROADMAP) | P4-3, P5-6 `workflow_dispute_kit` |
| Webhook event filtering, signature verification (EXPANSION_ROADMAP) | P4-5, P5-7 `workflow_webhook_health` |
| Payout scheduling, bank accounts, underwriting status (EXPANSION_ROADMAP) | P4-1, P4-6, P5-8 `workflow_go_live_checklist` |
| Usage-based metering, invoice customization (EXPANSION_ROADMAP) | P3-3, P2-6 |
| Financial reports, revenue recognition, tax documents (EXPANSION_ROADMAP) | P4-6 reports, P5-9 `workflow_month_end_close` |
| Team permissions and activity audit logs (EXPANSION_ROADMAP) | Stripe has no public API for team members. Covered instead by this server's own connection list, change log and `stripe_where_is_setting` |
| `stripe_issue_refund_and_cancel` + confirmation email hook (ClaudeBuildPlan) | P5-4 `workflow_cancel_customer` (Stripe's own receipt emails; a custom email stays with the Workspace connector) |
| Churn rate in revenue summary (ClaudeBuildPlan) | P5-1 `workflow_money_snapshot` |
| `stripe_mock_webhook` (Creation Docs) | P3-5 test clocks + P4-5 signature check; real test events come from test clocks, not a fake |
| Connect for multi-tenant SaaS (YardSync, Cortiware) | P9-1, optional, when a product needs it |
