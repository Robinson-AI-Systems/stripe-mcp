# G-4 hosted webhook ingress preflight (#192)

Status: IN REVIEW — CI and self-review required, not external acceptance.
Design: approved G-4 TEST webhook receipt path and 2026-10-12 finite acceptance.
Baseline: 3c2bdf6dad16a90ed89e245fa81e055529248a24; no active PR at inspection; deployment remains behind main.
Risk: owner-only opt-in read-only acceptance tool; no migrations or provider writes.

## Drift A
| Assumption | Actual | Correction |
| --- | --- | --- |
| A deployed receiver exists on current main | Implementation #153 and SQL receipts #160 exist; live is older #165 | Require exact deployed live SHA before route contact |
| CI signed HMAC acceptance closes G-4 | CI uses fixtures and local SQL, not genuine Stripe provider or protected Vercel ingress | Probe deployed route only; never label 405 signed acceptance |
| Could avoid owner pass/Stripe key | An unauthenticated GET must produce route-local 405 with JSON | Never carry any bearer, secret, event or payload |

## Deliverable
- Export existing strict RTC origin/live attestation helpers without changing behavior.
- Owner-run `node scripts/hosted-webhook-preflight.mjs` with five protected RTC_* environment values; zero CLI arguments.
- A pinned HTTPS GET manifest attests the *observed* live SHA; then a GET of the configured TEST webhook route must yield the receiver's own 405 JSON (not SSO, redirect, 404 or arbitrary HTTP success).
- No provider call, secret, signed POST, SQL, LIVE or deployment action; neither a PASS nor CI proves genuine event acceptance.
- Unit tests test safe path, early denial, HTML/SSO, absent deployment and no sensitive output.

Validation: PR exact-head check/unit/db/mock/rtc-reference/ci/target-main,
self-review and thread audit before merge. Local tests unexecuted in REST-only workspace.
Next: owner-protected ingress plus genuine Stripe-signed TEST event, then owner-private receipt lookup/replay; OAuth and D-4 independently outstanding.
