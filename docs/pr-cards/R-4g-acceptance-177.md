# R-4g — Owner-pinned RTC TEST HTTPS acceptance runner (#177)

Status: MERGED (#177) as-if; protected PR gate must actually pass before merge.
Design: R-2 TEST HTTPS and Hub D-4 approved read-only non-production acceptance.
Baseline inspected: 1b70b216442a15411bb9496e4c169b0d6edb0cd2 (#176 merge).
Dependencies: R-4f accurate manifest, R-3 real HTTP/Postgres, owner test-only access.
Risk: one opt-in external read path; no migration, Stripe write, default pass widening or runtime deployment.
Budget: bounded acceptance tool; no new server tool, credentials or provider endpoint.

## Read only these
AGENTS.md, SESSION-START.md, docs/HOSTING-COST-POLICY.md, Hub docs/CONTRACT.md
§§1–3/9 and D-4; src/core/rtc-http.js, src/tools/server.js,
src/acceptance/owner-test-smoke.js, scripts/owner-test-smoke.mjs,
tests/db/rtc-real-http.test.js; docs/acceptance/STRIPE-TEST-MILESTONE.md.

## Drift check A
| Prior assumption | Actual | Kind | Correction |
| --- | --- | --- | --- |
| GET /api/whoami identifies exact pass account | It returned mode/profile/areas but not account; absent identity weakens account isolation evidence | Actual gap | Add authenticated pass account ID, DB HTTP regression |
| CI green proves authenticated hosted read | CI tests localhost/fixtures; no owner pass plus deployed ingress has run | Acceptance | Add explicitly opt-in pinned HTTPS runner, never claim auto-completion |
| Stripe whoami proves provider read | stripe_whoami reads local DB/account settings, not Stripe API | Semantic | Separate optional real stripe_account_get read, projected ID-only |
| Reference tests prove revoked credential | Upstream fake tests not real server | Acceptance | Require exact hosted pass_revoked 401, never generic SSO 401 |
| Any HTTPS endpoint can receive an owner pass | SSO redirects and untrusted origins can receive bearer | Security | Require trusted two-variable exact origin, non-local HTTPS, redirect manual, JSON cap; no raw response or secrets logged |

## Implementation
- src/core/rtc-http.js: GET whoami exposes only its authenticated selected account ID.
- src/acceptance/rtc-service-check.js: separately verifies manifest, account/profile,
  safe catalog, direct read, one safe batch and write refusal over genuine HTTPS;
  no provider write, can optionally read Stripe TEST account identity via projected
  account_get and refuses if account area not granted.
- scripts/rtc-service-check.mjs: protected-env credentials only; opt-in
  --authorized-read-only / --authorized-provider-read / --verify-revocation.
  No CLI bearer arguments, redirects, secret output or persistent result.
- tests/unit/rtc-service-check.test.js: injected transport is a fixture, not
  hosted certification; tests malicious origins, SSO HTML, forged identity,
  unguarded write, cross-account provider, pin, scope and actual revoked-pass 401.
- tests/db/rtc-real-http.test.js: real disposable PostgreSQL+HTTP account identity.
- Existing auth money, pass isolation, audit, LIVE-off and CI untouched.

## External acceptance
Only owner permits TEST read and one-hour areas=server,account pass via private
one-time setup page; both origin env values must equal verified service HTTPS.
Capture redacted runner status, UTC, git live revision and Vercel READY; OAuth,
webhook, three Hub routes must each be independently accepted elsewhere.
No live/prod, no secrets in chat, logs, issues or GitHub artifacts.

## Validation and next
Run seven exact-head check/unit/db/mock/rtc-reference/ci/target-main, review audit
and safe merge. If deployed live remains historical or SSO inaccessible, external
status stays BLOCKED; successor can fix only independently demonstrated eligible
TEST acceptance defects or approved cards, never synthetic PR padding.
