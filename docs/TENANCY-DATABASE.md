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
