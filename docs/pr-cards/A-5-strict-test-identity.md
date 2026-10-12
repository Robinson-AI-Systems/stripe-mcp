# A-5 / B-8b1 follow-up — Strict provider TEST-key enrollment and reprobe (#142)
Status: as-if-merged; five exact-head CI gates and review required.
Scope: approved A-5 encrypted TEST key safety + B-8b1 permission probes, addressing a real missing strict identity gate.

## Drift A
- Current initial TEST enrollment checks only account ID and key name prefix, not actual provider `object:account` + boolean `livemode:false`.
- Owner-authenticated permission reprobe verifies a selected account string and encrypted key snapshot but previously ran nine provider permission reads before independently validating Stripe's own selected TEST account identity.
- G-5 and G-6 read paths already require strict provider TEST identity; use the same fail-closed semantic without expanding permissions or any LIVE/money operation.

## Acceptance
- Initial TEST enrollment never probes further or persists encrypted ciphertext if account ID/object or explicit boolean TEST mode is missing/foreign/LIVE.
- After loading an authorized TEST snapshot, reprobe requires fresh SDK accounts.retrieve identity exact to the selected account and explicit TEST before any of the nine permission reads or compare-and-swap update.
- Rotation-race checks remain atomic; no raw key, ciphertext or private provider record in responses/errors/logs. Existing enrolled key is not extracted/modified by this PR.
- Fake SDK unit, owner setup and isolated Postgres tests updated; negative fixtures cover missing/null/string/LIVE modes, object mismatch and foreign IDs. Full check/unit/db/mock/ci and self-review required. No real provider acceptance claimed.
