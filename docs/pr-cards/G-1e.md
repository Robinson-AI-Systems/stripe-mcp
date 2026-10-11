# G-1e — TEST payout schedule setter / guided fallback
Status: as-if-merged, exact-head CI and review pending.
Baseline b17b097 (#86). Design: BATCH-G §1 G5 and §4 G-1/G-5.

## Drift A
- Own-account Stripe payout settings writes may be refused (Connect-only): attempt
  only with verified selected TEST account, preserve false/uncertain result and
  return exact TEST dashboard steps. Never report an update without provider read-back.
- Manual/daily/weekly/monthly settings require matching anchors. No bank account
  numbers or payout creation, no LIVE key.
- No owner activation required: ordinary TEST settings change via defineWrite,
  full-only profile, app guard, confirmation, audit and idempotency.

## Acceptance
- money_set_payout_schedule, real-handler seven-case contract and provider-error
  guided fallback; Stripe pinned mock; updated catalog, registry and test counts.
- Five exact-head required checks before merge; no real Stripe TEST trial claimed.
- Next G-1f report export capability and G-1 closure.