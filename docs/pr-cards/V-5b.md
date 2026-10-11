# V-5b — Guarded TEST subscription clock setup
Status: MERGED (#73 as-if-merged; exact-head CI/review gate pending).
Baseline inspected: main 280e0a9 (#72). Design docs/designs/BATCH-V.md §V-5.
Risk: TEST-only Stripe writes and durable synthetic run provenance. No schema migration.

## Drift check A
| Approved assumption | Baseline evidence | Correction |
| --- | --- | --- |
| A simulation needs a new ledger | Existing dev_runs and dev_run_objects record verified per-step IDs and support V-2 cleanup | Reuse existing exact run ledger and metadata rtc_run |
| A TEST customer can be clocked directly by the subscription | Official Stripe test clock attaches to a newly created customer | Create named clock before new synthetic TEST customer, with test_clock |
| Creating a paid subscription proves month-one payment | TEST clocks advance async and payment can decline | Begin with one-day trial; no invoice money asserted; V-5c verifies each ready period |
| All test methods work for future card billing | Synthetic pm_card_visa and pm_card_chargeCustomerFail are used in existing TEST seed code | Restrict to validated methods until provider readback and tests expand |

## Implementation and evidence
- New dev_simulate_subscription guarded setup phase (months 1–3, amountCents
  100–50000, one of two supported synthetic cards, frozenTime, stable requestKey).
- Synthetic isolated clock, product, monthly price, clocked customer with
  attached TEST card, free-trial subscription: five independently retrieved
  provider IDs, recorded in dev_runs and dev_run_objects with rtc_run metadata.
- Full preview/confirm, unchanged requestKey replay, no LIVE, no app-owned
  mutation, no actual invoice charge in setup; one TEST provider readback each step.
- Exact clock name compatible with V-2b cleanup: RTC DEV RUN <runId> 1.
- Tests targeted unit, registry, profile and script budgets; full five-check CI.
- Successor V-5c: bounded month-by-month async clock advance and independently
  verified invoice/payment/event timeline. Do not infer paid from clock readiness.
