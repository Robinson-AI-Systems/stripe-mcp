# R-4i — Exact deployed live SHA attestation for TEST acceptance (#180)

Status: MERGED (#180) as-if; actual protected merge requires all seven final-head checks and resolved reviews.
Design: RTC public manifest §1 plus existing checked daily main→live hosting-cost policy
and finite owner TEST external acceptance in docs/acceptance/STRIPE-TEST-MILESTONE.md.
Baseline inspected: 05965e2b8bc2d9e2e15fb956534ef966ba73b0d4 (#179 merge).
Risk: read-only public revision provenance, acceptance gate. No SQL, Stripe write,
money, LIVE, new credential, paid Vercel tier or manual deploy.

## Read only these
AGENTS hard limits, SESSION-START, DRIFT-PROTOCOL, HOSTING-COST-POLICY,
api/contract.js, src/core/rtc-http.js rtcManifest, src/acceptance/rtc-service-check.js,
scripts/rtc-service-check.mjs, tests/unit/rtc-http.test.js,
tests/unit/rtc-service-check.test.js, docs/STATUS.md.
Vercel official system env metadata docs (VERCEL_GIT_COMMIT_SHA/REF and VERCEL_ENV);
do not modify Vercel env flags without separate owner authorization.

## Drift check A
| Assumption | Actual | Kind | Correction |
| --- | --- | --- | --- |
| Historical READY Production proves latest code | After #179, current main 05965e2..., live still 8068f52...; last known READY Production historical main 8068f52... | Deployment evidence gap | Public contract conditionally includes actual Vercel runtime SHA/ref/environment; never synthesize from latest main |
| Owner-pinned origin implies source revision pinned | #177 runner validated domain/pass but never checked deployed source branch/SHA | False external pass risk | Require separately observed exact `RTC_EXPECTED_DEPLOYED_SHA`, deployed ref=live and environment=production before any bearer invocation |
| Real revocation status proves latest live behavior | #177 revocation runner called whoami without verifying deployed source revision | Scope/evidence | Public revision preflight (no credential), exact revision then owner revoked-pass 401 |
| Local CI equals checked daily scheduled release | Seven CI jobs are on PR/main; first actual scheduled main→live and Vercel READY live revision unverified | Acceptance drift | Keep separate BLOCKED until checked scheduled promotion and actual HTTPS contract metadata |

## Build and regressions
- api/contract.js passes only three Vercel-provided nonsecret system env fields
  into rtcManifest; refuse malformed/absent metadata, no request-supplied SHA.
- src/core/rtc-http.js rtcManifest(registry,deployment?) adds optional bounded
  `deployment:{sha,ref,environment}`, without altering MCP clients/counts/guards.
- src/acceptance/rtc-service-check.js requires exact independently pinned
  40-char SHA, ref `live`, environment `production` before pass usage.
  Revocation preflights same uncredentialed contract. Missing system variables,
  old main branch or mismatch → explicit failure, never PASS.
- scripts/rtc-service-check.mjs reads `RTC_EXPECTED_DEPLOYED_SHA`
  only from protected runner environment alongside existing credentials.
- Unit regressions reject absent/malformed/wrong revision, historical main,
  bad branch/env and confirm negative no credential invocation.
- All seven exact-head checks and review threads required; no manually forced
  Production release. Local development may omit deployment metadata; only
  genuine deployed TEST acceptance strictly requires it.

## Next
#180 concludes this five-PR slot only when merged with seven green checks,
post-merge main CI observed and permanent owner handoff posted. Actual
connected OAuth, genuine Stripe TEST account read, Stripe-signed webhook
receipt and Hub D-4 three-route/revocation evidence are separate owner-protected
acceptance gates. If Vercel system env autoexposure is disabled, record blocker
and seek owner approval; never silently toggle deployment settings.

## Exact-head CI defect discovered during #180
An unrelated, preexisting dual-listener PostgreSQL quota test assumed all
150 concurrent HTTP requests hit the same `date_trunc('minute',now())` SQL
bucket. CI observed 122 successes when the legitimate shared 120/min quota
reset across a minute boundary. Make this test independently verify the
actual SQL bucket before/after the burst and retry **only** straddling
bursts with separate isolated one-hour TEST passes. Keep strict exact
120 successful/30 denied expectations inside one bucket, unchanged
production quota, dual listeners and PostgreSQL atomicity. This is
clock-boundary CI reliability, NOT an RTC authorization widening.
