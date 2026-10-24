# CAP-3 — verified identity, tenant membership and grant lifecycle

Status: **IN_PROGRESS source engineering**; original CAP-3 remains unfinished until actual OIDC provider, Stripe App OAuth/mobile connection and optional advanced credential lifecycle pass. Baseline `215645a62cac84d132c163ea37044edca7e39a40`.

## Drift check and code reuse
- Existing owner OAuth remains `src/core/oauth-handlers.js`, `src/core/mcp-auth.js`, `src/db.js`; its selected account and legacy encrypted secret in `src/keys.js` have no verified human principal and **must not** be automatically assigned to a new tenant.
- `src/stripe/credential-context.js` is source-only (`canExecute:false`); do not promote metadata to actual provider authority.
- `src/core/profiles.js` and `src/tools/access.js` retain ordinary Full/read-only policy. Existing money-out owner approvals and account-wide $500/day guard cannot be relaxed.
- New independent identity issuer needs standards-maintained OIDC verification, not a homemade password or server flag. No real issuer/provider has been selected; build only the inactive storage/authorization foundation.
- Normal main→live release, custom subdomain, current PUBLIC_BASE_URL and existing OAuth clients remain unchanged.

## Migration and source scope
New tables are additive and isolated, with owner membership verified independently from the Stripe account grant. Legacy `stripe_accounts`/OAuth tokens remain **unassigned**, not seeded into new grants. Membership changes revoke old revisions; grant descriptors store no raw key. No endpoint or tool should call enrollment yet. Tenant-owned grants can only become usable after a separately verified Stripe App/provider credential operation and exact selected account; a metadata match is never an execution grant. Denial happens before provider I/O.

## Frozen complete original outcome
<!-- bundle-plan:start -->
```json
{
  "baseRevision": "215645a62cac84d132c163ea37044edca7e39a40",
  "workKind": "ENGINEERING",
  "outcome": "Build an additive, real-database-tested CAP-3 verified-identity, tenant-membership and credential-free grant lifecycle foundation with server-owned immutable ownership, atomic revocation and no production/legacy permission widening.",
  "integrationBoundary": "Only offline tenancy schema, trusted-internal store and operation-aware grant metadata resolver. Do not wire public signup, OAuth callbacks, existing provider key lookups, Stripe API transport or LIVE writes before independent human OIDC and Stripe App grants are verified.",
  "newEngineering": "Add isolated identity/tenant/member/account-grant tables and indexes, atomic owner-scoped grant create/revoke and membership versioning, read-only scoped grant resolution, client linkage/migration quarantine markers and extensive disposable PostgreSQL race/foreign/stale/security tests. Reuse existing Neon SQL adapter and original OAuth token lifecycle.",
  "estimatedProductionLines": 550,
  "relatedWorkDecision": "The original CAP-3 is a provider-credential and human-identity bundle; this substantial single-provider database foundation is partial source implementation within CAP-3. CAP-2 remains IN_PROGRESS and will share the tenancy/grant resolver after independent OIDC exists. CAP-4 and CAP-5 stay dependency-gated.",
  "subsections": [
    {
      "id": "CAP-3",
      "acceptance": [
        "Verified human identities and tenant memberships must be distinct from a Stripe account authorization; operator, production customer, product administrator and developer roles require explicit, current server-checked memberships.",
        "Typed Stripe account/Connect/organization grants must bind tenant, stable person, verified provider account, mode, issuer/resource, permission revision and credential kind, with no cross-tenant credential or operation fallback.",
        "Grant enrollment, ownership changes, revocation, replacement, expiry and concurrent use must be atomic and fail closed, without exposing provider bearer secrets or authorizing provider I/O based on metadata alone.",
        "Legacy owner-managed accounts/OAuth connections must remain compatible but unassigned; ownership migration requires independently proven owner identity, and ambiguous credentials must never become customer grants.",
        "Use disposable real PostgreSQL tests for independent identities, two tenants, same person different roles, foreign account/mode, stale membership, concurrent revocation, and negative provider-authority assumptions; keep signed-in independent money-out approval and LIVE safeguards unchanged."
      ],
      "remainingEngineering": [
        "Implement provider-backed human sign-in through a maintained OIDC verifier, with verified issuer/subject and PKCE/state/nonce, before calling identity-enrollment internals.",
        "Implement one-screen branded Stripe App account consent and automatic mobile client return using registered Stripe App OAuth grant and independent identity.",
        "Build encrypted tenant-bound credential lifecycle, real policy-based resolver, original OAuth connector migration and Full/God Mode upgrades with actual operation scope evidence.",
        "Prove every direct, RTC, indirect and HTTP door with real PostgreSQL/independent provider and client acceptance, without changing signed-in money-out policy."
      ]
    }
  ]
}
```
<!-- bundle-plan:end -->

## Tests and gate
Disposable real PostgreSQL, two independent principals and tenants, owner/customer role isolation, wrong context/account, stale membership, idempotent enrollment, parallel membership/credential revocation and no legacy owner key adoption. Unit negative tests for bearer redaction and exact issuer/account selection. Exact-head CI, target-main, review and merge, with source versus real deployment acceptance tracked separately. This packet is not permission for LIVE payment, provider registration or domain publication.

## Source checkpoint — 2026-10-24

The CAP-3 source branch adds five inactive tenant tables in
`src/tenancy/store.js`, gated by
`STRIPE_TENANCY_SCHEMA_APPROVED=enabled`. The store provides
separate human/tenant/context memberships, stale revision refusal,
provisional credential-free account descriptors, exact owned
revoke, and hashed single-use client state. `src/tenancy/selection.js`
always returns `canExecute:false` and refuses automatic broader
grant selection. Real PostgreSQL and unit tests cover foreign tenants,
identity role switching, wrong accounts, stale or revoked membership,
concurrent exact-grant revocations and one-use callback state.

**Status remains IN_PROGRESS:** no public human OIDC provider, verified
Stripe App OAuth, real encrypted provider grant, connection token
binding, production migration, mobile callback or God Mode is
implemented. These are original CAP-3 engineering, not external
excuses or completed acceptance.

## CI correction checkpoint

First PR #289 CI at `2183fa8b` found untyped nullable PostgreSQL
parameters, too-permissive HTTPS provider-resource classification,
and two schema-inventory expectations affected by inactive gated
tables. These were actual fixture/source mismatches, not provider
blocks. Corrected optional SELECT casts, `api.stripe.com` exact
host check, and separated default schema inventory from the gated
CAP-3 tables. No test was skipped. Require fresh exact-head CI before
merge; keep original CAP-3 IN_PROGRESS.
