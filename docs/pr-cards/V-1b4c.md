# V-1b4c — TEST clock dependency for real overdue renewals

Status: **MERGED (#53 as-if-merged, pending exact-head CI and review)**.
Baseline main f5f8cceefab923e6874ef847c7a85786bdd4f383 after #52. Approved V-5 test clocks brought forward only as required for V-1b4 subscription renewal, not a claim that V-5 is complete.

## Drift check A

| Assumption | Confirmed API/repository behavior | Correction and test |
| --- | --- | --- |
| Clock time advancement completes synchronously | Stripe initially returns advancing, transitions to ready later | Only mark done when Stripe independently reads status ready and target frozen_time |
| Test clocks have rtc_run metadata | Stripe test clock schema has name but no metadata | Prefix tool-created names RTC DEV; keep run-tagging rule for objects that support metadata; future V-1 seeded clocks require explicit durable ledger exception and cleanup policy |
| Existing native clock tools already exist | None registered | Add native TEST list/create/advance through guarded tool contract |
| Old static clock timestamp can ignore Stripe limits | Provider caps advance to two shortest subscription intervals | Preflight bounded times and rely on Stripe to enforce exact limit |
| Deleting clocks is safe before V-2 cleanup | Clock deletion may delete dependent customers/subscriptions | Leave destructive testclock_delete to cleanup-aware V-5 continuation |

## Implementation

- TEST-only testclock_list reads bounded provider clocks or one exact ID and surfaces status, frozen time and asynchronous target; no secret/credential output.
- Guarded testclock_create uses Stripe testHelpers.testClocks.create with stable idempotency, explicit preview/confirm and independently verified newly created RTC DEV clock. No money operation.
- Guarded testclock_advance checks RTC DEV provenance, provider ready state and monotonic time, requests pinned native advance, independently verifies the requested time and ready status; if still advancing, returns unconfirmed and list exposes the pending target instead of reporting a fake success.
- All writes use existing defineWrite; no owner-consent bypass for money because these tools do not move funds. App-owned safeguards remain; no LIVE, external Stripe account, migration, new permissions or spending.
- Files: src/tools/testclocks.js; registry + discovery/profile counts; tests/unit/testclocks.test.js, tests/mock/testclocks.test.js, authoritative docs and catalog.
- Verification: check, unit, mock, DB and combined CI complete at exact final PR head and reviews resolved. This GitHub-only environment cannot execute the local tests.

## Successor

V-1b4d implements a real subscription renewal/past_due workflow using TEST clocks, persisted account-scoped seed records and provider-confirmed invoice/subscription status; confirmed ACH transitions and Connect capability-gated marketplace still needed before V-1 complete. V-5 future general simulator/test cards and safe testclock_delete remain separately approved and unimplemented.
