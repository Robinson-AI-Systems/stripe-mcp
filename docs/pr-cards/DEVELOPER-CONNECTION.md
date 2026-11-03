# Reusable developer connection — owner authorized 2026-10-13

## Outcome and boundary
Let the implementing agent connect once, retain its developer authorization securely,
refresh access and run approved tests without repeated owner-page pass creation or copying.
This does not restrict the production MCP catalog, supported operations or runtime profiles.
Development authority applies to the implementing/testing agent and approved test resources;
it is not a blanket read_only restriction on the finished product. Full test profiles remain
available for genuine fixture writes; independent money-out, paid capacity, live activation,
production data destruction and resource-isolation gates remain unchanged.

## Integration and acceptance
- Reuse native OAuth code + S256 PKCE, existing owner consent and refresh/revocation logic.
- Mobile owner opens one prefilled link; no bearer or account ID copied through chat.
- Credentials remain in protected client storage, never MCP tool results or instructions.
- Expired access refreshes within the existing grant; revoked/invalid grants require consent.
- Each standalone service remains usable without Hub; rtool manages multiple connections.
- Native MCP testing uses the connected developer principal and existing write guards.
- Separate source, offline tests, deployed revision and real provider/scratch acceptance.

## Fleet classification — OPERATOR surface (RAS MCP Standard, 2026-11-02)

Per Library D-001's fleet developer access boundary and row 4 of
[RAS-MCP-CONFORMANCE](../RAS-MCP-CONFORMANCE.md), this connection is this
server's **operator surface**: a backend developer/operator control-plane
entry for the implementing agents, in the same class as the owner setup
pages. It is never a public sign-in mode, login choice, consent option,
advertised onboarding path, tool-catalog capability or public page link,
and it is never linked from the public front door, the public connection
material, OAuth metadata or any client snippet. Three identity contexts
exist and never silently merge: **customer** (public sign-in grants),
**developer** (this connection's grants — TEST contexts and fixtures
only, never LIVE customer authority, never LIVE acceptance evidence) and
**operator** (the owner acting through the passphrase-gated setup and
consent surfaces). The owner passphrase gates are **transitional**:
preserved while needed, with named operator identity the recorded
direction; a passphrase alone never mints developer context. Any future
TEST-grant issuance beyond this connection follows the D-001 `DevGrant`
minimum specification: its own grant type, short-lived, default
read-only, journaled, never imported into public users, never exchanged
for live customer authority.

## Bundle plan — developer access boundary implementation (2026-11-02)

<!-- bundle-plan:start -->
```json
{
  "baseRevision": "04d2fdf9635b7c6a4871a7067431101b85c571e8",
  "workKind": "ENGINEERING",
  "outcome": "Make the fleet developer access boundary real in source for the implementing-agent connection: every OAuth grant carries a server-derived context, developer-context grants fail closed on LIVE customer operations at issuance, refresh and the MCP door, boundary refusals are journaled without secrets, and the operator classification plus transitional passphrase marking are recorded in code and docs.",
  "integrationBoundary": "Additive only, inside the existing OAuth grant store, token handlers, MCP bearer door and developer handoff modules. No change to the public connect/consent journey's behaviour, no tool added or changed, no release-identity (VER-1) fields, no provider call, no LIVE action, and the existing operator connection's TEST flow is preserved end to end.",
  "newEngineering": "Additive oauth_tokens context typing with issuance stamping and refresh propagation (real and fake stores), a DeveloperAccess resolver with no public-user fallback, fail-closed crossover enforcement at token issuance, refresh and requireMcpToken, a dedicated developer boundary event journal, transitional/classification marking, and crossover tests in both directions plus a public-surface no-developer-link guard.",
  "estimatedProductionLines": 330,
  "relatedWorkDecision": "This completes the source engineering for RAS-MCP-CONFORMANCE row 4 under this existing card; the row's live acceptance (entitled developer versus ordinary-user denial pair at the checked deployed release) stays open and the row remains DESIGNED / NOT VERIFIED at live level. CAP-3/CAP-5 connection-contract work and VER-1 release identity are separate workstreams on their own branches and are not touched beyond shared-file-compatible additive seams.",
  "subsections": [
    {
      "id": "DEVELOPER-CONNECTION",
      "acceptance": [
        "The implementing-agent developer connection is classified and enforced as the operator surface: never linked or advertised from the public front door, public connection material, OAuth metadata or tool catalog, and never presented as a sign-in class.",
        "Every OAuth grant carries a server-derived context (customer or developer), stamped at issuance from the server's own records, propagated through refresh, and never taken from caller input.",
        "Developer-context grants fail closed on public LIVE customer operations at issuance, refresh and the MCP door, including pre-typing legacy grants derived from their registered client; customer grants never acquire developer context and cannot use the developer handoff beyond the existing registered-callback rule.",
        "Boundary refusals are journaled without secrets in a dedicated additive store, and journaling failure never changes a refusal outcome.",
        "Owner passphrase and setup surfaces are marked transitional in code and docs; named operator identity is recorded as the direction and nothing existing is disabled.",
        "Future TEST-grant issuance is bound to the D-001 DevGrant minimum spec in the repo record: own grant type, short-lived, default read-only, journaled, never imported into public users, never LIVE and never LIVE-acceptance evidence.",
        "The existing operator connection keeps working unchanged for TEST use: handoff start, owner consent, sealed-code polling, token exchange and refresh behave as before for TEST grants."
      ],
      "remainingEngineering": [
        "Additive oauth_tokens.context column with issuance stamping, refresh propagation and fake-db parity",
        "DeveloperAccess resolver module (src/developer/access.js) with no public-user fallback",
        "Fail-closed enforcement at token issuance, refresh and the MCP door, with boundary-event journaling",
        "Transitional marking of passphrase/setup surfaces in code and docs",
        "Public-surface no-developer-link guard plus crossover unit and DB tests in both directions",
        "Card, conformance record, DECISIONS, STATUS and ARCHITECTURE updates"
      ]
    }
  ]
}
```
<!-- bundle-plan:end -->

## Resume
Implemented mobile PKCE/RSA authorization handoff in each standalone service and native
rtool OAuth connection/refresh/check/call commands in Hub's CLI. Product catalog/profile
filters unchanged. New service-owned developer_oauth_handoffs table is additive and lazily
initialized by the developer endpoint, separate from native provider/account storage.
Unit/CLI tests run locally; SQL race/expiry tests require disposable CI Postgres.
CI provenance guard separates standard connectors and custom-service proof. Exact-head CI,
reviewed deployment, initial owner consent and real provider/scratch acceptance pending.

## Boundary implementation delivery — 2026-11-02

Landed on branch `ai/vivienne/developer-access-boundary` (bundle plan
frozen in the planning commit directly on `04d2fdf9`): additive
`oauth_tokens.context` typing with issuance stamping and refresh
preservation (real store + fake store parity); the `DeveloperAccess`
resolver (`src/developer/access.js`); fail-closed crossover enforcement
at token issuance, refresh and the MCP bearer door; the
`developer_boundary_events` refusal journal; journaled handoff-start
refusals; OPERATOR classification comments on the connection and
transitional marking on the passphrase/setup surfaces; crossover and
guard tests (`tests/unit/developer-boundary.test.js`,
`tests/db/developer-boundary.test.js`). The existing connection flow is
unchanged for TEST: the pre-existing handoff, OAuth and MCP-auth suites
pass alongside the new ones. Remaining, deliberately not built here:
the live acceptance pair for conformance row 4 (runs at the checked
deployed release after the daily promotion) and any `DevGrant` issuance
surface beyond this connection (bound by the minimum specification in
the classification section above when a consumer exists).

CI correction cycle (2026-11-02, same PR): the first exact-head CI run
failed the database job on `tests/db/dev-runs.test.js`, whose
`dev_%` table inventory is an exact pin — the new
`developer_boundary_events` table falls under that prefix. The pin was
updated to include the journal table (the same treatment as the
`SCHEMA_TABLES` pin in `tests/unit/schema.test.js`); no assertion was
weakened. Verified locally on disposable Postgres (dev-runs, boundary
and MCP-wire suites, 15 tests) before the single correction push.

## Role-drift and completion review
Read docs/reviews/2026-10-13-completion-recovery.md. Review the actual source/index
before extending scope: preserve full product capability, isolate builder permission,
use the native custom service for acceptance, and finish finite supported workflows.

## Connection review corrections — 2026-10-13

Authenticated polling retries return the same encrypted authorization code until the
original request expires; native OAuth token exchange remains single use. The trusted
service client-IP helper and atomic per-IP SQL counter enforce concurrent start quotas.
Backend outages return retryable 503 instead of malformed-request 400. Native 32-character
Google authorization codes are accepted, and its consent page retains the requested
profile while leaving the final choice to the owner.

Evidence must explicitly track all eight layers exactly once. Deployment-provider metadata
can prove only deployment; runtime acceptance must use the actual custom-service transport.
Full provider acceptance includes permitted reads/writes, resource and identity denial, and
provider readback. Schema validity alone supplies none of these observations.

Regression tests cover these failures; exact PR CI and real provider acceptance are separate.

Follow-up review: completed handoffs remain immutable until expiry even if another process
starts setup for the same client. Hub acceptance requires a Hub-mediated RTC route and
its readback; standalone MCP initialization or a bare service RTC request is insufficient.

## Agent connection recovery when private plugin tools are absent

The owner's phone/Android client is not a reason to repeat provider setup or to stop
custom-service acceptance. A private plugin's tools being absent from this conversation
is distinct from missing provider credentials, expired access tokens, revoked service
grants and a runtime that cannot issue HTTPS requests.

1. Read this card and inspect this conversation's actual terminal/HTTP capabilities.
   If a native custom-service tool is callable, use it. Otherwise use the existing
   rtool native developer client against this service's verified deployed OAuth/MCP origin.
   A cloud agent runtime can do this while the owner stays on mobile; the owner's PC
   is not the runner. Standard provider connectors remain infrastructure tools only.
2. The shared client is in Robinson-AI-Systems/robinsons-toolkit-hub:
   packages/cli/bin/rtool.js and packages/cli/src/{developer-client,developer-vault,developer-checkpoint}.js.
   Configure RTOOL_SERVERS with this service's alias and independently verified exact
   origin; use OS keychain storage or RTOOL_DEVELOPER_VAULT_DIR in a private non-Git directory.
   Run developer-check, developer-tools and developer-call using the syntax below.
   These developer commands call the standalone service directly; they do not require
   Hub federation to be finished.
3. For the coordinating Repo Management runner, six saved native grants are retained in
   the existing Hub project's Development-only encrypted RTOOL_BUILDER_SESSION checkpoint.
   Retrieve only that named secret through authorized Vercel control-plane tools,
   privately restore an empty vault with restoreDeveloperCheckpoint and exact-origin
   validation, then saveDeveloperCheckpoint after token changes and before stopping.
   Never print, commit, attach, place in Library or send credential values to another chat.
   See Hub's DEVELOPER-CONNECTION card for the existing recovery procedure.
4. **One serialized runner owns that checkpoint.** It is not a concurrent shared token
   pool. Do not restore stale checkpoint copies over newer local credentials or run
   independent agents against the same rotating refresh tokens. A different agent
   coordinates acceptance with that runner, or uses its own separately authorized grant.
   Persist approved test evidence in the relevant repository so implementing agents can
   use it without receiving credentials.
5. Expired access normally renews with the saved refresh grant. An authentication failure
   alone does not prove owner consent is lost: check exact origin, deployment protection,
   saved record freshness and refresh outcome first. Avoid testing renewal by setting the
   client clock in the future against a live server: that can save an inaccurate expiry.
   If a saved access expiry is known stale, renew through developerAccess using actual
   current time and persist the replacement. Never replay a possibly executed mutation.
   Request new consent only after a genuine revoked/invalid grant or added authority is proved.
6. If this particular conversation has neither native custom tools nor an HTTPS-capable
   execution runtime, report that specific limit and coordinate the required run/evidence
   with the existing runner. Do not ask the mobile owner to install a desktop plugin,
   copy passes, reconnect the underlying provider, or certify a test the agent cannot run.

Commands below run from a checkout of the shared Hub CLI, with this service's exact
origin and protected vault configured. rtool can also be used when installed. The CLI
server alias must match the existing saved record; a renamed alias is a different record.
Deployment protection, where present, requires its authorized exact-origin access
in addition to service OAuth; do not disable protection or switch to a convenient alias.

```sh
node packages/cli/bin/rtool.js developer-check stripe
node packages/cli/bin/rtool.js developer-tools stripe
node packages/cli/bin/rtool.js developer-call stripe stripe_whoami --args '{}'
```

Initialize/tool discovery/identity, provider reads, fixture writes/readback/cleanup,
scope denial, renewal/revocation and Hub federation are separate evidence. Record
the exact deployed revision/origin before claiming real acceptance. Successful standard
connectors, source CI, mock providers or another service's connection prove none of
this server's independent acceptance. Preserve its complete product catalog and all
existing operation-specific approval/isolation/spending gates.

### This repository's purpose and first identity check

Stripe customers, payments, subscriptions, invoices and account administration. Verify TEST account/mode, required readbacks and cleanup; LIVE, money-out and spending approvals remain separate.

Use `stripe_whoami` through this service's own saved `stripe` grant. The six connections were directly rechecked by the coordinating runner on October 13, 2026; all six authenticated initialize requests succeeded without desktop plugin activation. That transport observation does not complete this repository's provider/write/RTC/Hub acceptance. Current grants were saved after renewal; reverify actual identity, scope and deployed revision on the next run.
