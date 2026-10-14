## Genuine custom Stripe TEST V-3 observation — 2026-10-13 Denver / 2026-10-14 UTC

The existing authenticated **Robinson Stripe Cloud** connection returned selected account TEST/full/restricted identity. Vercel independently showed READY Production at exact `live` SHA `3cb4831d85a30950b9ee0e1e5f13488faa83eba5` (PR #211), not a preview. On that deployed custom service, `account_get` returned safely projected `chargesEnabled`, `payoutsEnabled`, and `detailsSubmitted` booleans; detailed `verification` remained `not_readable`. After guarded dry-run/confirmation, a true `dev_trigger_event(customer.created)` returned `done:true,confirmed:true`; that handler independently verified the original Stripe Event. Separate `dev_list_runs` returned one `completed` run with `objectCount:2`. Guarded `dev_cleanup` cleaned the single disposable TEST customer and intentionally retained immutable Event evidence; separate custom-service `customer_get` returned `deleted:true`. The generic cleanup failure banner despite proven deletion is an observed usability defect; #213 fixes source/CI behavior without claiming that revised behavior is deployed. One immutable event remains recorded, not a stray mutable customer. This supports a V-3 TEST customer-created positive path only, **not** other trigger types, full event delivery, OAuth refresh/revocation, webhook signing, Hub routes, LIVE or Dashboard acceptance. No money moved.

# Stripe TEST milestone — evidence ledger (2026-10-12)

This ledger is intentionally finite. PASS never means an equivalent adjacent
boundary passed. Each evidence row names the execution environment and a
reproducible test or observation; synthetic/CI tests cannot certify hosted
Stripe, OAuth, Webhook, or Toolkit Hub D-4. No provider mutation was authorized.

| Boundary | Status | Evidence (what was actually observed) | Required closure evidence |
| --- | --- | --- | --- |
| Implemented source | PASS | Main 43b44fb (#175): /api/mcp plus RTC /api/contract, /api/openapi.json, /api/tools, /api/whoami, /api/results; guarded TEST receiver. Six post-merge CI jobs SUCCESS. | Confirm exact deployed revision separately. |
| Local service HTTP + PostgreSQL | PASS (existing subset; #181 new OAuth SDK wire requires seven-head CI) | tests/db/rtc-real-http.test.js and rtc-dual-http.test.js run real HTTP and isolated PostgreSQL in GitHub Actions, including 120 shared-rate successes / 30 excess denials and revocation. The #176 manifest/catalog wire regression requires its own exact-head CI. | Preserve real test evidence and distinguish it from two external deployment instances. |
| Deployed HTTPS at current revision | BLOCKED | Vercel last independently observed READY Production is historical main 8068f52, while current main 43b44fb and live 8068f52. Vercel SSO remains enabled. | Observe next scheduled checked main→live and a READY Production deployment tied to that live commit. Authorized ingress GET /api/contract plus TEST-pass GET /api/whoami and safe call. Do not force promotion or remove SSO. |
| Connected custom-MCP OAuth | UNVERIFIED | Unit/persistent OAuth tests exist; a connected client performing real PKCE redirect, TEST account selection, refreshed-token preserved settings and authenticated /api/mcp tool read has not been independently witnessed. | Owner-authorized external client completes login and safe read; verify refresh does not widen account/mode/profile/listing/areas; revoke and observe denial. |
| Genuine Stripe TEST provider reads | UNVERIFIED | Encrypted TEST enrollment exists; owner-reported partial internal readiness smoke is not a captured independent external provider read. CI fakes/mock are not Stripe. | Run harmless exact-account TEST-only identity and non-PII read against the connected deployed server; record sanitized status and provider mode without payload/secrets. |
| Signed Stripe TEST webhook receipt | UNVERIFIED | Receiver, 300-second HMAC and isolated PostgreSQL replay/receipt tests exist. No owner-enrolled, genuine Stripe-signed TEST delivery to the exact hosted route and private receipt lookup is on record. | Configure owner-approved TEST destination/signing secret safely (no secret in logs); deliver genuine TEST event, verify exact endpoint/event receipt and duplicate denial via protected owner view. Ingress must survive SSO via authorized method, without globally relaxing protection. |
| Toolkit Hub D-4 direct | UNVERIFIED | Hub reference fixture conformance != authenticated service route. | Short-lived one-hour owner-issued read_only pass; trusted pinned HTTPS endpoint; safe direct TEST metadata call and post-revocation 401. |
| Toolkit Hub D-4 GitHub relay | BLOCKED | Private relay issue/webhook credentials and signed ingress/immutable bindings have independent Hub owner gates; no real end-to-end routing verified. | Hub D-4 sanctioned private issue binding, HMAC ingress, encrypted relay round trip, actor isolation and revocation, with sanitized proof. |
| Toolkit Hub D-4 Vercel Sandbox | UNVERIFIED | Offline reference tests do not establish a real Sandbox connection. | Hub Sandbox invokes the same hosted service with scoped read-only TEST pass, records only non-secret result shape and verifies expiry/revocation. |
| Full RTC 1 conformance | UNVERIFIED (actual-service subset gate #182 added, not full certification) | rtc-reference CI runs the upstream fixture. Stripe service has its own real HTTP/DB subset, but writes/full profiles cannot run through TEST HTTPS passes. | Run applicable conformance against the ACTUAL deployed service, report each skipped unsafe/full-profile case separately, do not label restricted subset full certified. |

## #195 secure ingress support and first-head CI correction

The protected origin now supports optional `VERCEL_OIDC_TOKEN` in the owner's private environment through a single fail-closed pinned HTTPS-only fetcher shared by the four hosted TEST acceptance scripts. The helper never forwards a short-lived trusted-source token cross-origin, allows no redirects, and never changes Vercel SSO/Trusted Sources settings; actual development→production access still needs explicit owner-approved Vercel configuration. Source unit coverage only until exact-head green. A successful public DCR 201 implies temporary client cleanup is required even if its response metadata is unusable.

## #195 opt-in owner browser OAuth authorization PKCE hosted acceptance

`scripts/hosted-oauth-pkce.mjs --owner-approved-test-pkce` provides an owner-only browser authorization-code S256 PKCE acceptance path for the original independent MCP. It requires exact independently observed live deployment, registers public temporary client and ephemeral local loopback callback, binds CSRF state, lets the owner enter their real password only through the protected service browser, exchanges a one-use code over HTTPS and verifies the exact TEST/read_only account through source SDK. No secret is returned in the report. Owner revocation of the temporary TEST connection is mandatory. Local fake transport and loopback tests are source/CI evidence only; without real signed-in browser/SSO, PKCE and provider acceptance remain UNVERIFIED. Hub relay/Sandbox, true Stripe signed event and G-6 Dashboard remain separately gated.

## #194 opt-in source-owned OAuth refresh remote acceptance

Owner protected `scripts/hosted-oauth-refresh.mjs --owner-approved-test-refresh` checks exact deployed live SHA, old read_only scoped SDK identity, one real service OAuth refresh token rotation, new read_only TEST identity, and original access-token rejection. The refresh request is deliberately never retried; reporting is stages only. The newly issued credentials are not exported, requiring independent owner revocation of this TEST connection after the attempt. CI fixture source evidence is distinct from a genuine execution; interactive OAuth PKCE browser approval, external provider read, signed TEST receipt and all Hub routes remain UNVERIFIED. No LIVE or money authority.

## #193 external standalone custom-MCP SDK credential probe

New opt-in `scripts/hosted-custom-mcp.mjs` runs only on owner-protected process credentials and only after exact observed live deployment attestation. It exercises an actual standalone MCP SDK read-only catalog/identity through `/api/mcp`, and separately checks a truly revoked connector token produces application `401 invalid_token`. Source and fixture regressions require PR CI; even remote PASS cannot prove an interactive OAuth PKCE authorization-code flow, token refresh, genuine Stripe TEST provider read, signed webhook, or any Hub direct/relay/Sandbox. Those external layers remain UNVERIFIED and require separate authenticated evidence and permission.

## #192 owner-only hosted webhook route preflight

New `scripts/hosted-webhook-preflight.mjs` uses a pinned protected origin, independently observed live deployment SHA, exact TEST account and endpoint selector. It sends only public GET requests (no bearer/secret/Stripe API call); success requires the receiver's own method-not-allowed 405 JSON after live attestation, not an SSO/redirect/404. Unit fixture regressions are source-only pending PR CI. Passing this optional preflight proves only deployed route reachability and does NOT verify the configured signing secret, durable receipt, genuine Stripe-signed TEST event or duplicate denial. Existing external signed-delivery and owner-private receipt evidence remain UNVERIFIED until the actual authorized provider delivery occurs.

## #182 actual-service upstream RTC subset boundary

The CI db job runs the **pinned official Hub** `packages/conformance/src/run.js`
against a real local Stripe RTC HTTP handler, actual registry, disposable
PostgreSQL and TEST-only fake keys. It is NOT the fake-server-only upstream
`rtc-reference` job. The supported checks are manifest, manifest.openapi,
catalog, passes, passes.expired, passes.revoked and budget, plus
independent safe unknown-tool 404 and forbidden-write 403 assertions. The owner protected `rtc-service-check` runner now probes registered `stripe_payment_cancel`, not an unregistered `stripe_payment_intent_create`, so a hosted forbidden-write PASS must attest to an existing denied operation. Their status is PASS **only after #182
exact-head db CI is green**. The upstream raw full-profile `meta`, `reads`,
`writes` and `passes.read_only` and `safety` probes deliberately cannot pass: they
require published writable/full-profile HTTPS tools that the owner did not
authorize. `oauth.refresh_settings` and `limits.two_instance` remain
skipped by the upstream service-specific invocation; separate #181
real local SDK OAuth and #165 dual-listener PostgreSQL checks do not turn
these two upstream skips into a PASS. Overall full certification remains
false; deployed genuine RTC service/Hub direct, relay and Sandbox remain
independently unverified.

## Actionable external blockers and eligibility (recheck each session)

| Blocked evidence | Precise prerequisite / required proof | Eligibility trigger and next action |
| --- | --- | --- |
| Scheduled deployed source | `live` remains 8068f52, latest READY Production comes from historical `main`; the new `/api/contract` deployment attestation has not been seen on live. | After ordinary scheduled, checked `main→live` workflow succeeds, independently match live SHA to READY Production commit ref=live and runtime `deployment.sha/ref/environment` via authorized protected ingress. No manual deploy or unprotected preview. |
| Genuine OAuth + Stripe TEST API | Existing owner TEST key is encrypted, but owner-approved protected ingress plus independently used external OAuth PKCE client, refresh and revoke are not observed. The new #181 real local PostgreSQL/HTTP/MCP SDK test improves only automated proof. | Once exact live deployment and owner-secure external TEST client environment are available, capture sanitized actual PKCE account/profile, safe MCP read, refresh, revoke and non-PII Stripe provider read; never paste secret or invent PASS. |
| Stripe-signed webhook | Need owner-approved Stripe TEST signing secret and reachable protected test receiver plus private receipt readback; SSO must remain protected. | When ingress method and endpoint are independently verified, send a real Stripe TEST event, prove HMAC and durable account/endpoint/event receipt with replay denial; no broad SSO change. |
| Hub D-4 | Direct requires same owner-issued one-hour TEST pass and trusted live origin; private GitHub relay needs its separate binding/HMAC and permissions gate; Sandbox needs separately authorized runner. | After the exact respective owner gate and approved origin/identity are present, run direct, restricted relay, Sandbox and revocation **independently**; refuse preview mode, stale SHA and reference-suite-only proof. |
| G-6 / H-1 | Actual signed-in owner TEST Dashboard walkthrough and reconciliation to native reader results absent; H-1 dependency explicitly not met. | Once owner-secure Dashboard observation occurs, reconcile each G-6 item observed/partial/not_readable with independent readback before releasing H-1. |

Recheck this table after scheduled promotion, permissions changes, owner decisions and relevant merges. Authorization previously supplied for short-lived TEST-only read-only D-4 does **not** remove separate Hub relay, SSO, authenticated account or signed webhook evidence requirements.

## Secure owner-authorized closure sequence (never copy credentials into a chat)

1. Read GitHub current main/live, six CI jobs and Vercel production branch+deployment source SHA. Wait for scheduled-only promotion and confirm source exactly `live` plus READY. A READY historical `main` deployment is not equivalent.
2. In the owner-controlled protected setup browser, verify the selected TEST account, issue a one-hour pass restricted to only needed read areas, and consume the one-time credential into protected runner environment variable `RTC_TEST_PASS`. Do not put pass in URLs, command-line arguments, issues, artifacts, commits or tool responses.
3. Using the approved SSO-authenticated/secure ingress, read public contract and authenticated whoami/catalog/describe; call only harmless `stripe_whoami` and one account-scoped TEST metadata reader. Assert 200 JSON, exact TEST mode/account isolation, safe metadata, no money/write and no raw PII. Exercise wrong/missing/other-area pass and batch denial without provider mutation. Record UTC, revision, endpoint type, status and sanitized shape, never bearer or provider body.
4. From an independent custom MCP client, separately exercise OAuth+PKCE login, a scoped `/api/mcp` TEST read and refresh-preserved settings; then revoke connector and prove denial. HTTPS passes and OAuth bearer tokens MUST NOT be interchangeable.
5. For G-4, separately use the owner-approved Stripe TEST webhook settings and dedicated TEST signing secret, verify the exact HTTPS receiver is reachable without disabling global SSO, perform genuine Stripe TEST event delivery, and compare private receipt by account/endpoint/event. Verify replay handling; do not store raw event data.
6. Coordinate Hub D-4's own private GitHub relay owner gates and Sandbox runner. Run direct, relay, Sandbox as three separate tests, with time-limited read-only passes and exact revocation 401. If credentials/origin/bindings missing, mark BLOCKED, never synthesize PASS.
7. Destroy/revoke every temporary pass and connector test access, record non-secret final evidence in this ledger, and leave Stripe LIVE and money-out approval gates untouched.

## #180 exact running revision preflight

The public contract response *on the deployed host* now conditionally exposes
`deployment.sha`, `deployment.ref` and `deployment.environment` when all
three Vercel system environment values are present and syntactically valid.
This is runtime provenance, not a declaration that latest main is deployed.
The owner must independently inspect the scheduled checked GitHub
`main`→`live` release, actual live Git SHA and Vercel READY Production
deployment for that same live revision. Configure `RTC_EXPECTED_DEPLOYED_SHA`
to that **observed deployed live** commit in the protected runner environment.
All three opt-in `scripts/rtc-service-check.mjs` modes refuse absence,
mismatch, a deployment from `main` or a non-Production environment **before
using a temporary bearer credential**. Do not set it to the latest GitHub
main merely because CI passed.

If the deployed contract omits provenance because Vercel system variables
were not exposed, report `deployment_unverified` and verify Vercel
environment settings through approved read-only controls; do not silently
change them, bypass SSO or manually deploy. No real external TEST provider,
OAuth, signed webhook, Hub direct/relay/Sandbox or first scheduled promotion
is certified by adding these code paths.

## Release and safety invariant

PRs require all seven exact-head check/unit/db/mock/rtc-reference/ci/target-main jobs and thread-free reviewed merge. Production is promoted only by the scheduled checked main→live workflow. Automatic Vercel previews remain off, Basic builds queued, Neon 0.25 CU/300s idle. No financial writes, paid additions, LIVE enablement or manual deployment follows from TEST acceptance.

## #179 proof qualification and native-safe profile projection

PR #179 closes a real native HTTP selector mismatch: registered G-5 account_get
accepts only its safe enum field array, whereas the HTTPS adapter had converted
arrays to strings before native validation. The opt-in provider proof now requests
`id`, `chargesEnabled`, `payoutsEnabled` and `detailsSubmitted` and requires
booleans actually returned by a verified Stripe TEST account read. A permission-
denied fallback `{id,available:false}` must not count as a provider PASS.
Only status codes are displayed. Offline fake SDK/unit confirmation cannot be
reclassified as actual external Stripe TEST acceptance. Owner credentials and
scheduled exact revision hosted ingress remain necessary.

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

## K-3 Stripe source private package rehearsal (#184 candidate only)

CI now includes a *source-owned* disposable original-service rehearsal against
a Hub private archive pinned to immutable commit `08f4189` and expected SHA256
`3038f7664e18ac57e5fdb86daf0884f603a78a446e2f1300f20fd59a92e73ea6`.
Source parity of four leaf imports, full tar digest/identity, seven original
unit and nine original SQL/HTTP/dual-connection suites must pass on #184 exact
head before marking this local CI layer PASS. The six adapted modules remain
unadopted; independent authenticated human consent and $500 Colorado day override
require separate service-owned proof. This is **not** a published GitHub Release,
installed production dependency, external Stripe TEST call or Hub D-4 certification.

## K-3 one-time-secret service-owned adapter (#185; CI required)

Stripe's actual throwaway `one_time_secrets` SQL is the test target for
the private Hub `one-time-secrets` export (not a fabricated adapter schema).
Two independently connected DB clients verify original↔portable ciphertext
compatibility, exact `stripe-once` AAD and setup URL, atomic consume-once,
account/mode tamper refusal and expired-row rejection with synthetic secrets.
Source's default one-time store remains deployed and no unpublished import
enters runtime. Record this slice PASS only on exact #185 CI, distinct from
package Release, financial owner consent, OAuth bearer or Hub external D-4.

## K-3 private profile adapter service proof (#186, pending exact-head CI)
The source's actual `isGuardedTestWrite` and `listingForConnection`
remain Stripe-owned while generic profile exports are privately imported from
the immutable core archive for six actual source unit and five real disposable
service PostgreSQL suites. Test mode write declaration/caller/profile
restrictions must remain safe. Never mark final package adoption or owner
money approval solely from this import rehearsal. Restore original
`profiles.js` before CI concludes; no deployed dependency changes.

## K-3 bearer source-owned adapter (#187; requires exact-head CI)
Direct original-vs-portable bearer challenge and identity comparison plus
four actual original Stripe unit/six PostgreSQL suites under temporary
private-core `mcp-auth` source entry-point overlay. Source durable
token owner profile, TEST-only, case-insensitive Bearer, stripped projected
credential, duplicate Authorization evidence and 503 SQL outage are
separate intentional requirements; restored source remains default. See
`K3-STRIPE-SOURCE-HANDOFF.md`. Genuine deployed OAuth, owner login
money consent, Hub D-4 and published package adoption remain UNVERIFIED.

## #197 release guard review repair (merged; production proof separate)

The merged #196 review (resolved in #197) found an additional timezone-first cron item could bypass the source release validator. #197 changes the checker to inspect the entire single-item schedule with reordered-key regression coverage, and records the automatic multiple-of-five session boundary and same-conversation owner-intervention policy in existing instructions. All seven PR-head checks and six exact final-main application jobs passed; actual live deployment remains separate. it does not verify scheduled execution, an authenticated custom MCP, genuine Stripe TEST reads, signed delivery or Hub routes. Latest independently rechecked GitHub main/live baseline at session start: `1ded9276a4dc3310802360221ca21d195e197b64`; no unauthorized manual release.

## Owner setup canonical hostname and alternate Vercel aliases (#199 proposal)

The service deliberately has one OAuth issuer and owner-form origin: `PUBLIC_BASE_URL`. On 2026-10-13 the owner visited the alternate `stripe-mcp-psi.vercel.app` alias and received a 403 on setup POST. Vercel's configured canonical origin is `https://stripe-mcp-chris-projects-de6cd1bf.vercel.app`; its one verified encrypted TEST key remains unaffected. Proposed #199 redirects alternate-host owner-setup **GET** requests to `PUBLIC_BASE_URL/api/stripe/setup` before creating a CSRF cookie; query selectors are not reflected. It keeps POST restricted to exact canonical Origin, owner CSRF and passphrase. This is usability/security regression work, not actual authenticated connected Stripe TEST acceptance. The change requires exact-head CI/review and a separately checked scheduled live deployment; use the canonical address immediately in the meantime.

## Owner-visible TEST result and ambiguous page reset (#200 proposal, 2026-10-13)

Owner reported that submitting the G-6 administration read-only TEST form appeared to reload without clear feedback. Source inspection proves an accessibility/placement defect: the per-tool report and the rejection/status message are inserted after five long owner forms below the fold. This does **not** prove the original request succeeded or failed; the runtime logs only provided GET deprecation warnings, not an authenticated Stripe TEST result. #200 moves the form to the start of the page, adds a prominent top-of-page request response with sanitized group/tool/status/counts and explicit non-certification, preserves detailed allowed technical results on demand, and makes validation failures visible. The result payload remains strictly allowlisted, account/mode owner authentication and CSRF are unchanged, and no Stripe operation is added or executed by this fix. Current deployed #199 is separate from the proposed source change; the owner must still rerun on the exact deployed #200 after an approved checked release before any connected TEST acceptance can be marked observed.

## #201 authenticated owner TEST diagnostic stages (proposed; not deployed)

Owner returned failure string from the deployed #200 form, confirming passphrase and CSRF were accepted but identity or report checks failed. The actual failing substage cannot be inferred from Vercel GET warnings. Exactly one encrypted restricted TEST key is enrolled in isolated Neon; existence does NOT mean valid identity at time of recheck. Proposed #201 distinguishes selected account unenrolled, key loading failure, provider denial, identity unverified or incomplete, read-only tool contract defect and report mismatch behind the owner password only. It never reveals provider error messages, IDs, raw account payload, secret or key; no Stripe mutation, LIVE activation or production deployment. Review all owner-page forms and acceptance flow together before any new release.

## #202 holistic owner setup UX and hardening (proposal; no production claim)

This PR groups existing owner forms by intent using accessible native sections, lifts one-time secrets and money/default/LIVE/revocation confirmations to the top, and introduces a password-authenticated read-only directory of enrolled TEST account IDs and escaped labels so the owner can select the exact account for diagnostics without re-entering a Stripe key. No raw key, LIVE-only account, permission change or provider call is returned from the directory. Strict 32-character private selectors avoid oversized GET intent queries, with universal no-referrer/anti-frame headers. Original actions, password, Origin, CSRF, preview and money approvals, database isolation, Stripe LIVE disable and output escaping remain unchanged. Only an independently observed user retry against a checked consolidated deployed revision can establish genuine Stripe TEST acceptance.

## #203 owner setup schema performance (proposal; not deployed)

Full review found owner setup invokes the complete additive SQL initialization on each GET/POST, regardless of whether the request will run TEST verification or whether the same warmed function already completed schema setup. Proposed #203 memoizes a promise per serverless isolate, waits for it under concurrency, never serves a request before first schema initialization, resets the promise upon failure for a safe retry, and naturally reinitializes from scratch after a new deployment. All owner auth/CSRF/Origin, private key access, TEST readback validation and independent money confirmation remain unchanged. Unit tests are synthetic; they do not prove real Stripe provider acceptance or Vercel latency.

## #204 original endpoint HTTP preflight (proposal)

The owner API gateway previously initialized Neon before applying original-request body-size/media safeguards. The proposed fix rejects unsupported methods, invalid declared body lengths and oversized/mismatched forms before DB use with existing shared HTTP helpers. Exact-head CI and code review required. No Vercel release, no Stripe permission change and no shortcut around private password or CSRF.

## #205 real HTTP + disposable PostgreSQL owner setup journey (proposed)

The isolated test server serves the original `createSetupHandler` over an actual listening Node HTTP socket and the same `createDb` adapter with local disposable PostgreSQL: browser URL form parsing, private account metadata listing, password/CSRF/Origin denial, stable identity-error stage, bounded synthetic report output, real encrypted one-time consume/replay. No Vercel auth, public network or Stripe TEST provider connection is impersonated. #204 separately tests the actual API gateway's original HTTP wire-size boundary; #205 proves the inner handler and persisted behavior. External owner TEST/PKCE/webhook/Hub acceptance stays unverified, and CI green is not sufficient for production release.
