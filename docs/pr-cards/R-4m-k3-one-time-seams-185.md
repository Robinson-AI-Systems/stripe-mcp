# R-4m — K-3 encrypted one-time secrets on actual Stripe SQL

Status: IMPLEMENTED, exact-head checks/merge pending (#185).
Baseline: `c70fbcb4b8c7839200c0cd8308d92e2969417e65`, #184 checked private core 4 source-verbatim leaves.

## Objective
Prove the service-owned adaptation of PRIVATE Hub `./one-time-secrets`
using the original Stripe `createDb` schema and two independently connected
PostgreSQL clients. No runtime shared-core import or dependency.
Retain service AAD `stripe-once/id/account/mode/kind`,
row `stripe_account`, setup `/api/stripe/setup?show=id`,
AES-256-GCM key and 10 minute expiry.

## Acceptance
1. Existing private pinned SHA256 package install and 7 unit/9 SQL suites
still run as #184.
2. Stripe CI additionally uses adapted core from installed archive on actual
source `one_time_secrets` SQL: legacy-issued/portable-consumed and inverse,
atomic competing cross-pool consumption, ciphertext-only persistence,
account/mode tamper rejection and SQL expiry denial. Only synthetic strings;
no owner credential, no Stripe SDK, no remote DB.
3. Preserve source-owned original store for production; direct adaptation is
a reversible future release step, not actual adoption. Existing money approval,
OAuth and permission gates remain unchanged; seven exact-head jobs required.

## Drift
Hub portable `createOneTimeSecretStore` accepts explicit mapping functions,
unlike original source `createOneTimeStore`. The adopted mapping stays in
Stripe and preserves old ciphertext. No imported adjusted `mcp-auth`,
profiles, oauth-protocol, write or dispatch until separately proved.
