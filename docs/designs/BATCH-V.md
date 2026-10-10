# Design — Batch V: Developer tools (build and test with Stripe)

Status: **APPROVED** (Chris, 2026-10-10: "It is supposed to be a powerful development tool … able to work freely on any
project"). Scope and acceptance: `docs/PLAN.md` → Batch V. Cards V-1 … V-5. Depends on Batch D (write layer and
everyday tools exist). Tool list: `docs/TOOL-CATALOG.md` section Developer tools.

Everything here is **test mode only**: every `dev_*` and `testclock_*` tool refuses on a live connection, before reading
anything. These are the jobs a developer does while *building* something on Stripe, for any project — a new app, a
prototype, another toolset — not the jobs of running a business.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| V1 | Stripe's documented test payment methods (`pm_card_visa`, `pm_card_chargeCustomerFail`, `pm_card_createDispute`, `pm_usBankAccount`, …) exist at the pinned version | Stripe docs "Testing" page; record the list and URL in the PR |
| V2 | Test clocks exist at the pinned version | `node scripts/openapi-find.mjs "test clock"` |
| V3 | Stripe's webhook signature scheme (`Stripe-Signature: t=…,v1=<HMAC-SHA256 of "t.payload">`) | Stripe docs "Check the webhook signatures"; the official library's `webhooks.generateTestHeaderString` |
| V4 | There is no API to delete all test data or to resend a delivered event | Stripe reference; if one exists, use it and amend |

## 1. Decisions

**V1. Seeded data is tracked, not guessed.** `dev_seed` creates a **run** (`dev_runs`) and records every object ID it
creates (`dev_run_objects`); each object also gets metadata `rtc_run=<runId>` (RTC §10). Cleanup uses the recorded IDs,
never a search (Stripe's search index lags).

**V2. Scenarios, not random noise.** `dev_seed(scenario | description, size)` builds named situations from a small
library (`src/dev/scenarios.js`): `basic-store` (products, prices, customers, one-time payments, a refund),
`subscriptions` (active, trialing, past-due via `pm_card_chargeCustomerFail`, canceled, with invoices), `disputes`
(a charge disputed via `pm_card_createDispute`), `ach` (US bank account payments that settle later), `marketplace` (only
when Connect exists). A plain description is matched to scenarios and the preview says exactly what will be created.

**V3. Cleanup is precise and reversible-safe.** `dev_cleanup(run | 'all-runs')`: deletes customers (Stripe cancels their
subscriptions), voids open invoices, archives products and prices (prices cannot be deleted), deletes coupons and
webhook endpoints the run created — only recorded objects, test mode only, preview then `confirm`. `dev_reset_test_data`
is guided: Stripe's dashboard "Delete all test data" link and steps (no API, V4).

**V4. Trigger events the real way.** `dev_trigger_event(type)` performs the real test-mode action that makes Stripe emit
that event (like the Stripe CLI's `trigger`), from a curated list (`dev_list_triggers`: ~30 common events such as
`payment_intent.succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `checkout.session.completed`,
`charge.dispute.created`). Objects it creates are recorded in a run.

**V5. Event forwarding for apps under development.** `dev_create_forwarder(url, types)` registers a target (HTTPS, public
address only — private, loopback and metadata addresses refused) and creates a signing secret shown **once** on the
setup page, which the developer puts in their app as its webhook secret. `dev_forward_events(forwarder, eventIds |
since | types)` reads real events from Stripe and POSTs them to the target with a correct `Stripe-Signature` header made
with that secret; it reports each delivery's status code. This is how a developer replays events into a local or preview
app (a tunnel such as a Vercel preview URL works) without the Stripe CLI.

**V6. Time travel.** Test clocks move here from Batch E. `dev_simulate_subscription(price, months, card)` creates a clock,
customer and subscription, advances month by month, and returns a timeline of invoices, payments and events.

**V7. Test cards on demand.** `dev_test_cards(scenario?)` returns the right test payment method for a situation
(success, decline, insufficient funds, 3-D Secure, dispute, ACH success/failure) from the V1 list. Read-only.

## 2. Schema

```sql
CREATE TABLE IF NOT EXISTS dev_runs (id TEXT PRIMARY KEY, stripe_account TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  connection TEXT, description TEXT, scenarios TEXT[], status TEXT NOT NULL DEFAULT 'active', cleaned_at TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS dev_run_objects (run_id TEXT NOT NULL, object_type TEXT NOT NULL, object_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), cleaned BOOLEAN NOT NULL DEFAULT FALSE, PRIMARY KEY (run_id, object_id));
CREATE TABLE IF NOT EXISTS dev_forwarders (id TEXT PRIMARY KEY, stripe_account TEXT NOT NULL, url TEXT NOT NULL,
  types TEXT[], secret_enc TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_used_at TIMESTAMPTZ);
```

## 4. Work units (each: test-mode refusal test on a live connection; write-contract for every write)

### V-1 — Seed and runs (L, medium effort)
Tools: `dev_seed`, `dev_list_runs`. Tests: each scenario's preview lists exact objects; every created ID recorded; seeding
twice with the same `requestKey` creates nothing new; stripe-mock accepts every request.
### V-2 — Cleanup (M, medium effort)
Tools: `dev_cleanup`, `dev_reset_test_data` (guided). Tests: only recorded objects touched; a non-run object with the same
metadata is left alone; partial failure reported per object.
### V-3 — Trigger events (M)
Tools: `dev_list_triggers`, `dev_trigger_event`. Tests: each trigger's action sequence against fake Stripe; unknown type
refused with the list.
### V-4 — Event forwarding (M, medium effort)
Tools: `dev_create_forwarder`, `dev_list_forwarders`, `dev_delete_forwarder`, `dev_forward_events`. Tests: signature verifies
with the official library's `constructEvent` and the forwarder's secret; private/loopback URLs refused; secret never in a
result.
### V-5 — Test clocks, subscription simulation, test cards (M)
Tools: `testclock_*`, `dev_simulate_subscription`, `dev_test_cards`. Tests: timeline correct for 3 months on fake Stripe.

## 5. Stop-and-ask points
1. Any V0 row false: amend before that card.

## 6. Acceptance mapping

| PLAN Batch V line | Evidence |
|---|---|
| Test mode only, everywhere | live-refusal test per tool |
| Cleanup touches only recorded objects | `tests/unit/dev-cleanup.test.js` |
| Forwarded events verify like real Stripe deliveries | `tests/unit/dev-forward.test.js` |

## Amendments
