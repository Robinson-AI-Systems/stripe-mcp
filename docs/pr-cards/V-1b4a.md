# V-1b4a — verify asynchronous TEST seed outcomes against Stripe

Status: MERGED (#51 as-if-merged; exact-head CI and review required).
Parent: V-1b4; approved Batch V sections 1 and 4. Baseline main: 506ae4d1c66e4ffe5937725c1886d2f22b701f68.

## Drift check A

| Assumption | Actual at main | Kind | Correction / evidence |
| --- | --- | --- | --- |
| Dispute trigger means dispute outcome exists | #50 validates only initial charge; no event | Existing limitation | Require matching run-owned charge and actual dispute-created event |
| Unconfirmed ACH equals a settled debit | #50 explicitly does not confirm ACH | Existing limitation | Read precise status, verify full succeeded payment independently, never claim bank settlement |
| Provider event list proves global absence | Events are retained and listings are bounded | Stripe semantic | Absence reported as unobserved only, not nonexistent |
| Need new SQL schema for read-back | getDevRunById/getDevRunObjects already exist | Compatible | Reuse durable account-scoped IDs, no migration |

## Scope

- Single TEST-only read tool: dev_verify_outcomes(runId). Uses the existing account-bound completed run ledger, tracked payment/customer IDs, pinned provider, strict USD cents and rtc_run provenance.
- For disputed card fixtures, confirm actual disputed charge and charge.dispute.created event with an exact matching charge, payment and amount. Bound the event listing to 300 items; absence or expiry remains unknown. Never report webhook delivery.
- For ACH fixtures, distinguish unconfirmed, processing, failed and successful PaymentIntent states. Independently check the full charge before claiming provider-reported payment success. Never equate PaymentIntent success to bank settlement.
- No financial operation, new permission, new database migration, LIVE key, old-agent compatibility or remote Stripe activity. Owner approval and shared Denver-day limit remain unchanged.
- Files: src/tools/dev-verify.js, src/tools/index.js, tests/unit/dev-verify.test.js, tests/mock/dev-verify.test.js, registry/profile count regressions, V-1/STATUS/catalog.
- Validation: pinned SDK stripe-mock read shapes, actual handler run isolation/negative cases, full check/unit/mock/db/combined CI at the exact PR head and review against docs/AI-PR-READ-FIRST.md.

## Remaining V-1b4b dependency

Complete real active and past-due subscriptions, actual ACH progression through supported TEST methods, and Connect capability-gated marketplace. Test clocks/event simulation are approved V-5 work, so implement the necessary clock/trigger dependency explicitly, not synthetic status changes. V-1 remains IN_PROGRESS until those outcomes are truly verified. V-2 follows V-1 completion.
