# V-1b4d — real, resumable TEST-clock past-due renewals

Status: **MERGED (#54 as-if-merged; exact-head CI and reviews required)**.
Parent: V-1 (still IN_PROGRESS); baseline main f3742633900930e1756dc59b929bbfa7a49f52fd (PR #53). Approved Batch V section 1, actual pinned Stripe API and previous V-1b4c clock dependency.

## Drift check A

| Assumption | Actual code / Stripe | Resolution |
| --- | --- | --- |
| Initial failed automatic collection implies past_due | Stripe sets incomplete on initial charge failure; later trial-end/renewal failure can be past_due | Create real 7-day trial with attachable decline-on-charge TEST payment method; advance clock past trial; verify actual status |
| Advancing TEST clock instantly completes | Stripe returns advancing until asynchronous ready | Persist every ID; return run still running; caller repeats same requestKey when clock is ready |
| Every Stripe-created record accepts rtc_run metadata | TestClock has name, but NO metadata parameter | Exact RTC DEV RUN runId/index name + durable account-scoped object ID is the exception; products/prices/customers/subscription/invoices use rtc_run |
| Subscription automatically creates invoices | Initial zero-dollar trial invoice and later failed invoice arise from Stripe | Discover by verified subscription.latest_invoice, independently verify and tag each; track both |
| Retry may safely recreate objects | Existing dev_runs and dev_run_objects unique account/run ID and step | Re-read every recorded object and bind provider IDs; immutable frozenTime and step plan digest; per-step stable idempotency |

## Implemented

- New named and plain-language subscription-past-due TEST seed scenario, size 1–5, requiring immutable explicit frozenTime. No LIVE, no real money, no inference from the chosen test card.
- Resumable 7-step record for each unit: TEST clock, product, recurring price, synthetic test-clock customer with pm_card_chargeCustomerFail default, trialing subscription, tagged zero-dollar paid first invoice, and later independently verified attempted unpaid renewal invoice.
- After exactly verifying run-owned trial objects, submit Stripe clock advance from frozenTime to frozenTime+8 days with one stable request key. Do not declare success during advancing or lagging subscription states. The same dev_seed requestKey resumes without recreating already recorded objects. Only Stripe status past_due plus a separate open, attempted, wholly unpaid correct-customer USD renewal invoice can complete the run.
- Test clock has no metadata by Stripe API design. Its exact RTC DEV RUN name and ledger ownership are mandatory. Record this provider-semantic exception in CHANGES-SINCE-DESIGN and DECISIONS; V-2 cleanup must explicitly handle clock ownership/dependent objects, not a guessed metadata search.
- New exhaustive true-handler two-phase success/retry/early-out/fail-closed/LIVE regression suite and pinned stripe-mock routes.
- Existing money-out approval and $500/Denver-day cap untouched. No provider account connected or real operation executed.

## Acceptance and successor

Only exact read-back completes; run remains running while waiting for asynchronous event. Runtime 12h stale-run fail-closed window from V-1a preserved. V-1 still requires controlled ACH lifecycle verification and Connect-capability-gated marketplace; then V-2 cleanup, V-3–V-5 and later batches.
