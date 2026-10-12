# Stripe TEST milestone — evidence ledger (2026-10-12)

This ledger is intentionally finite. PASS never means an equivalent adjacent
boundary passed. Each evidence row names the execution environment and a
reproducible test or observation; synthetic/CI tests cannot certify hosted
Stripe, OAuth, Webhook, or Toolkit Hub D-4. No provider mutation was authorized.

| Boundary | Status | Evidence (what was actually observed) | Required closure evidence |
| --- | --- | --- | --- |
| Implemented source | PASS | Main 43b44fb (#175): /api/mcp plus RTC /api/contract, /api/openapi.json, /api/tools, /api/whoami, /api/results; guarded TEST receiver. Six post-merge CI jobs SUCCESS. | Confirm exact deployed revision separately. |
| Local service HTTP + PostgreSQL | PASS (existing subset) | tests/db/rtc-real-http.test.js and rtc-dual-http.test.js run real HTTP and isolated PostgreSQL in GitHub Actions, including 120 shared-rate successes / 30 excess denials and revocation. The #176 manifest/catalog wire regression requires its own exact-head CI. | Preserve real test evidence and distinguish it from two external deployment instances. |
| Deployed HTTPS at current revision | BLOCKED | Vercel last independently observed READY Production is historical main 8068f52, while current main 43b44fb and live 8068f52. Vercel SSO remains enabled. | Observe next scheduled checked main→live and a READY Production deployment tied to that live commit. Authorized ingress GET /api/contract plus TEST-pass GET /api/whoami and safe call. Do not force promotion or remove SSO. |
| Connected custom-MCP OAuth | UNVERIFIED | Unit/persistent OAuth tests exist; a connected client performing real PKCE redirect, TEST account selection, refreshed-token preserved settings and authenticated /api/mcp tool read has not been independently witnessed. | Owner-authorized external client completes login and safe read; verify refresh does not widen account/mode/profile/listing/areas; revoke and observe denial. |
| Genuine Stripe TEST provider reads | UNVERIFIED | Encrypted TEST enrollment exists; owner-reported partial internal readiness smoke is not a captured independent external provider read. CI fakes/mock are not Stripe. | Run harmless exact-account TEST-only identity and non-PII read against the connected deployed server; record sanitized status and provider mode without payload/secrets. |
| Signed Stripe TEST webhook receipt | UNVERIFIED | Receiver, 300-second HMAC and isolated PostgreSQL replay/receipt tests exist. No owner-enrolled, genuine Stripe-signed TEST delivery to the exact hosted route and private receipt lookup is on record. | Configure owner-approved TEST destination/signing secret safely (no secret in logs); deliver genuine TEST event, verify exact endpoint/event receipt and duplicate denial via protected owner view. Ingress must survive SSO via authorized method, without globally relaxing protection. |
| Toolkit Hub D-4 direct | UNVERIFIED | Hub reference fixture conformance != authenticated service route. | Short-lived one-hour owner-issued read_only pass; trusted pinned HTTPS endpoint; safe direct TEST metadata call and post-revocation 401. |
| Toolkit Hub D-4 GitHub relay | BLOCKED | Private relay issue/webhook credentials and signed ingress/immutable bindings have independent Hub owner gates; no real end-to-end routing verified. | Hub D-4 sanctioned private issue binding, HMAC ingress, encrypted relay round trip, actor isolation and revocation, with sanitized proof. |
| Toolkit Hub D-4 Vercel Sandbox | UNVERIFIED | Offline reference tests do not establish a real Sandbox connection. | Hub Sandbox invokes the same hosted service with scoped read-only TEST pass, records only non-secret result shape and verifies expiry/revocation. |
| Full RTC 1 conformance | UNVERIFIED | rtc-reference CI runs the upstream fixture. Stripe service has its own real HTTP/DB subset, but writes/full profiles cannot run through TEST HTTPS passes. | Run applicable conformance against the ACTUAL deployed service, report each skipped unsafe/full-profile case separately, do not label restricted subset full certified. |

## Secure owner-authorized closure sequence (never copy credentials into a chat)

1. Read GitHub current main/live, six CI jobs and Vercel production branch+deployment source SHA. Wait for scheduled-only promotion and confirm source exactly `live` plus READY. A READY historical `main` deployment is not equivalent.
2. In the owner-controlled protected setup browser, verify the selected TEST account, issue a one-hour pass restricted to only needed read areas, and consume the one-time credential into protected runner environment variable `RTC_TEST_PASS`. Do not put pass in URLs, command-line arguments, issues, artifacts, commits or tool responses.
3. Using the approved SSO-authenticated/secure ingress, read public contract and authenticated whoami/catalog/describe; call only harmless `stripe_whoami` and one account-scoped TEST metadata reader. Assert 200 JSON, exact TEST mode/account isolation, safe metadata, no money/write and no raw PII. Exercise wrong/missing/other-area pass and batch denial without provider mutation. Record UTC, revision, endpoint type, status and sanitized shape, never bearer or provider body.
4. From an independent custom MCP client, separately exercise OAuth+PKCE login, a scoped `/api/mcp` TEST read and refresh-preserved settings; then revoke connector and prove denial. HTTPS passes and OAuth bearer tokens MUST NOT be interchangeable.
5. For G-4, separately use the owner-approved Stripe TEST webhook settings and dedicated TEST signing secret, verify the exact HTTPS receiver is reachable without disabling global SSO, perform genuine Stripe TEST event delivery, and compare private receipt by account/endpoint/event. Verify replay handling; do not store raw event data.
6. Coordinate Hub D-4's own private GitHub relay owner gates and Sandbox runner. Run direct, relay, Sandbox as three separate tests, with time-limited read-only passes and exact revocation 401. If credentials/origin/bindings missing, mark BLOCKED, never synthesize PASS.
7. Destroy/revoke every temporary pass and connector test access, record non-secret final evidence in this ledger, and leave Stripe LIVE and money-out approval gates untouched.

## Release and safety invariant

PRs require all seven exact-head check/unit/db/mock/rtc-reference/ci/target-main jobs and thread-free reviewed merge. Production is promoted only by the scheduled checked main→live workflow. Automatic Vercel previews remain off, Basic builds queued, Neon 0.25 CU/300s idle. No financial writes, paid additions, LIVE enablement or manual deployment follows from TEST acceptance.

## Opt-in owner runner added by #177 (source only, not a PASS)

After the scheduled checked `live` deployment and independently verified
trusted HTTPS ingress, configure `RTC_SERVICE_ORIGIN` and
`RTC_APPROVED_ORIGIN` to the SAME exact approved HTTPS origin; supply
`RTC_EXPECTED_ACCOUNT` and a one-hour server/account scoped `RTC_TEST_PASS`
using secure process environment settings. Never paste pass or environment dump.
Use `node scripts/rtc-service-check.mjs --authorized-read-only` for safe native
RTC HTTP service checks. Use `--authorized-provider-read` only when the owner
has approved a harmless genuine Stripe TEST account read. It calls
`stripe_account_get` with `fields:['id']`; unlike `stripe_whoami`, this is
intended to check the actual provider. The output contains only stage codes, never
provider body or credentials.

After revoking that pass through owner controls, supply it in the protected
`RTC_REVOKED_PASS` environment variable and run
`node scripts/rtc-service-check.mjs --verify-revocation`. This MUST receive the
server's exact 401 `pass_revoked`; HTML SSO, unknown, expired and generic 401
are not proofs. Recorded direct proof does not certify OAuth, Hub relay/Sandbox,
signed webhooks or full RTC 1. Never run external acceptance before the deployed
revision, owner identity and SSO ingress have been verified.
