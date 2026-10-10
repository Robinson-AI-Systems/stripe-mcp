# Design — Batch W: Workflows in Chris's language

Status: **APPROVED once IN-00 is answered.** Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch W.
Cards W-1 … W-10. Depends on Batches D, G, H, P. Tool list: `docs/TOOL-CATALOG.md` section Workflows.

Each workflow does a whole job server-side and answers in plain English, with `structuredContent` for agents (Batch C).
Read-only workflows are in `read_only`. Write workflows preview everything first and confirm before money moves.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| W1 | `listAll` and the time budget helper exist | `grep -n "export" src/stripe/client.js` |
| W2 | Every tool a workflow calls exists and passes its write-contract | `grep -n "<tool name>" src/tools/*.js` per workflow |

## 1. Decisions

**W1. Workflows call tools through the registry** (the wrapped handlers), never Stripe directly, so guards apply once and
consistently.

**W2. Time budget 50 s** (Vercel limit). Out of time → return what is done, with a note and how to continue.

**W3. MRR is computed correctly** (audit bug 6): sum over active subscription items of `unit_amount × quantity`, normalised
by `interval` and `interval_count` (month = 1, year = 1/12, week = 52/12, day = 365/12), minus active discounts
(percent and amount-off, respecting duration), per currency (never added across currencies); metered and tiered prices
reported separately as "usage-based, not in MRR"; trialing shown separately. Paged through all subscriptions.

**W4. Money snapshot windows** are Colorado calendar dates; money in/out summed from balance transactions in the window,
per currency.

## 4. Work units (tests: normal case, empty account, more than one page, two currencies, time budget exceeded)

| Card | Workflow(s) | Notes |
|---|---|---|
| W-1 (M) | `workflow_money_snapshot` | MRR fixture: quantity 2, quarterly price, 20% coupon, trialing, two currencies → hand-computed numbers in the test |
| W-2 (M) | `workflow_failed_payments`, `workflow_customer_overview` | decline reasons in words; when Stripe retries next; hosted invoice link; app record marked |
| W-3 (M) | `workflow_refund_customer` | finds the charge from a plain description; shows refundable amount |
| W-4 (M) | `workflow_cancel_customer` | now or period end; optional refund; optional void of open invoices; one preview of everything; app guard respected |
| W-5 (S) | `workflow_change_plan` | exact difference via `create_preview` |
| W-6 (M) | `workflow_dispute_kit` | gathers customer, receipt, invoice, signed agreement link via profile metadata; saves draft; lists what Chris must add before the deadline |
| W-7 (M) | `workflow_webhook_health` | per endpoint: events vs each profile's needs, undelivered events (3 days), test/live parity; fix via `webhook_add_events` |
| W-8 (L) | `workflow_go_live_checklist` | generic test-vs-live comparison for any account; delegates to `workflow_app_readiness` for each profile on the account; catalog copy only for profiles without `owns_catalog` |
| W-9 (M) | `workflow_month_end_close`, `workflow_set_up_catalog`, `workflow_find` | month close includes a report-run download link for the accountant |
| W-10 (M) | `workflow_brand_business` | logo/icon, colors, kit, descriptor, public details, invoice defaults, portal look; ends with a test Checkout link; run twice changes nothing; per item "done" or "needs you: <link>" |

## 5. Stop-and-ask points

1. A workflow would need a tool that does not exist: build the tool in its area batch first (or use Batch U), never inline
   Stripe calls in a workflow.

## 6. Acceptance mapping

| PLAN Batch W line | Evidence |
|---|---|
| MRR correct | `tests/unit/workflow-money-snapshot.test.js` |
| Webhook fix exact | `tests/unit/workflow-webhook-health.test.js` |
| All writes confirmed and logged | write-contract via `stripe_call` for each write workflow |

## Amendments
