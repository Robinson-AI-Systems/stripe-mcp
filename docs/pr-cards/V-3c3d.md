# V-3c3d — Genuine Stripe TEST Checkout Session completion (interactive source)

Status: MERGED (as-if-merged; exact-head green CI and review required).
Approved design: docs/designs/BATCH-V.md §4 V-3. Baseline: #65 merged at 8279d7d.
Scope: create real Stripe-hosted TEST Checkout URL, verify actual customer completion and original Event; no fake event or implied purchase. No migration.
Read docs/SESSION-START.md §0, AGENTS.md, DRIFT-PROTOCOL §A/B,
src/dev/triggers.js, src/tools/dev-events.js, src/dev/run-store.js,
src/dev/cleanup.js, tests/unit/dev-events.test.js, tests/mock/dev-invoice-events.test.js.

## Drift A
| Design/card assumption | Verified native Stripe API | Resolution |
| --- | --- | --- |
| Agent can automatically complete Checkout using server SDK | Sessions API offers create/retrieve/expire, not complete; Checkout controls its PaymentIntent | Use actual hosted TEST Checkout URL and user/browser payment action; never fake completion |
| Session create implies checkout.session.completed | Created status=open, payment_status=unpaid | Keep run running with session URL visible through dedicated read tool; only provider completed+paid verified |
| Stripe-generated payment is automatically run-tagged | Must pass payment_intent_data metadata | Require independent PI retrieval and exact run/customer/amount/succeeded, record provider-generated PI in durable ledger |
| Checkout ID is simple cs_ | Native TEST sessions use cs_test_ | Validate cs_test_ ID and ledger prefix explicitly |
| Completed session may be expired/deleted to clean | Completed payments and Event are immutable | Only open run-owned session may be expired after verified provider response; completed retained |

## Build contract
- Add curated checkout.session.completed, TEST only, no LIVE.
- Plan product(3600), one-time USD price(3600), synthetic customer, Checkout Session and provider PaymentIntent/Event.
- Create real stripe.checkout.sessions.create({mode:'payment',customer,line_items:[{price,quantity:1}],payment_method_types:['card'],success_url, cancel_url, metadata, client_reference_id, payment_intent_data:{metadata}});
- Guard no Stripe card data collected. New read tool dev_get_checkout_test_url({runId}) returns exact still-open hosted URL after run/account/metadata/status verification; no URL invented in preview.
- Stripe-hosted user/test-browser pays with 4242 test card; upon retry verify session status complete, payment_status paid, amount_total 3600, customer/metadata/client_reference_id; retrieve matching Stripe-generated PI and verify succeeded/received 3600, then record PI.
- Only independently listed Event and exact events.retrieve with matching session ID, user TEST, original run, amount, paid and account confirms completion. Missing activity/event stays pending, not fake.
- TEST cleanup can expire only tracked open sessions; completed retained with financial evidence. No automatic TEST purchase, money-out, live, app ownership changes.
- Deterministic retry key, read-before-write and exact acct-scoped run ledger.

## Tests
- Guarded real handler no manual payment=>pending, URL read and account exclusion; after explicit simulated Stripe-hosted completion => verified PI+Event, exact replay no second session/payment.
- Invalid foreign or un-paid session/Event blocked; cleanup won't expire completed; sdk/stripe-mock native sessions and Event API.
- check, unit, mock, db, ci full exact-head pass before merge. Next V-3 reconciliation, then V-4.
