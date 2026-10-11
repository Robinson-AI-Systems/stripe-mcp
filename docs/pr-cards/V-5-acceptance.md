# V-5 acceptance — Developer TEST clocks, fixtures and simulation
Date 2026-10-11. Implementation: testclock_* #53, V-5a #72, V-5b #73
(restored #75), V-5c1 #74, V-5c2 #76, V-5c3 #77.
Automated acceptance status: PASS once this PR's exact-head CI is green.
Provider-connected end-to-end TEST status: PENDING enrollment, never claimed.

## Drift check A
| Approved V-5 requirement | Exact evidence | State |
| --- | --- | --- |
| Public synthetic TEST payment fixture lookup without PAN/keys | tests/unit/dev-test-cards.test.js | Automated PASS |
| Existing clock create/list/advance and refusal in LIVE | tests/unit/testclocks.test.js | Automated PASS |
| Guarded account-isolated 1–3-month setup, run-tracked objects | tests/unit/dev-subscription-sim.test.js | Automated PASS |
| At-most-once month advance and durable uncertainty | tests/db/simulation-cycles.test.js and tests/unit/dev-simulation-advance.test.js | Automated PASS |
| Original Stripe invoice, payment allocation, PI and Event verification | tests/unit/dev-simulation-observe.test.js | Automated PASS |
| Full three-month independent fake provider timeline, no duplicated POST | tests/unit/dev-simulation-three-months.test.js | New exact-head CI required |
| Real Stripe TEST account, actual three renewals and events | Not executed: no enrolled TEST account/test key | External smoke PENDING |

A mocked Stripe provider validates code sequencing and safety, not an actual
financial or provider workflow. No action has been performed against a real
connected account. Batch V code acceptance is separate from the externally
pending V-3 genuine hosted Checkout and V-4 signed webhook acceptance.
Neither external smoke is a reason to fabricate results.

Next queue G-1 is independent of credentials; do not activate LIVE or
real-money operations. Every money-out remains owner-approved, $500 default
per account per Denver day and larger amounts require owner override.
