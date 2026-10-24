## 2026-10-24 — CAP-3 tenant-bound encrypted provider-grant vault (inactive source)

A gated sixth tenancy table `tenancy_secrets` stores only
AES-256-GCM ciphertext and CAS generation/revocation metadata. New
`src/tenancy/vault.js` reuses the existing `src/core/crypto.js`
and unique AAD containing tenant/person/context/membership revision/
grant/Stripe account/TEST-LIVE/credential kind. Metadata queries
return no ciphertext, API key or bearer; the vault has **no provider
execution method** and reports `canExecute:false`. Storage requires
an existing exact current owned *pending* grant descriptor. A stale
membership, different account, expired/foreign/revoked grant, wrong
key kind/mode, reused CAS or wrong AAD fails closed. Disposable
PostgreSQL tests exercise encryption-at-rest, wrong-context refusal,
parallel rotation, revocation and credential isolation.

The table is initialized ONLY by the separately approved
`STRIPE_TENANCY_SCHEMA_APPROVED=enabled` gate or direct
disposable-test initializer. The flag is **not** activated, and
neither current legacy Stripe keys/OAuth accounts nor provider money
actions are modified. No real OIDC provider, Stripe App installation,
new MCP user authentication or God Mode credential selection exists
yet. Original CAP-3 remains IN_PROGRESS, not a provider acceptance
PASS or completed indexed subsection.

# CAP-3 tenancy schema and migration guard

**Inactive source foundation as of 2026-10-24, not provider/user acceptance.**

Five new schema tables belong to `src/tenancy/store.js`:
- `tenancy_principals`: stable opaque hash of issuer + subject, not raw
  subject or tokens. An independently verified OIDC identity is required
  before any real person can be provisioned.
- `tenancy_tenants`: opaque tenant ID; no automatic owner adoption.
- `tenancy_memberships`: exact tenant/principal/context, active role and
  monotonically increasing membership revision. Development, product
  administration, and production are separate contexts.
- `tenancy_grants`: server-owned keyless provisional account descriptors
  with account/mode/credential kind and revocation. No method promotes
  these descriptors into executable Stripe credentials.
- `tenancy_auth_intents`: one-use hashed state binding the person,
  tenant, membership revision, client, account, kind and mode, with
  ten-minute expiry. Consuming one does not create a Stripe OAuth token.

**Production migration gate:** `db.initSchema()` does not initialize
these tables unless the separately owner-approved environment flag
`STRIPE_TENANCY_SCHEMA_APPROVED=enabled` is explicitly set.
Disposable localhost PostgreSQL tests instead call
`db.tenancy.initializeTables()` in their isolated schema. No such
flag has been activated on the Stripe Vercel project.

Historical `stripe_accounts`, encrypted TEST/LIVE keys, owner OAuth
codes and connector tokens remain unassigned and unchanged. An old owner
passphrase is not proof that a real person owns a new tenant. A future
verified migration must either prove an exact existing owner/tenant or
quarantine the connection and require a secure reconnect; it must
preserve existing encryption AAD, refresh family and source guards.

**Before turning on actual multi-user login**: integrate maintained
OIDC signature/issuer/nonce/audience validation, provider-owned Stripe
App OAuth with verified installation, one-screen ChatGPT/Claude return,
per-tenant encrypted grants and provider permissions; then link client
OAuth tokens with actual identity/member revision and test revocation.
These are still original CAP-2/CAP-3 engineering and CAP-5 provider
acceptance, not completed by these database tables.

No Stripe API request, financial approval, LIVE activation, publishing,
DNS migration or production database mutation was performed.
