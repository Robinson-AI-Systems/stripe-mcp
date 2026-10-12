# R-4p — Private K-3 OAuth protocol on authentic source account/UI
Status: IMPLEMENTED; PR #188 exact-head CI, source regression and review required.
Baseline: `fc8f3636ad7d7cd5c42ed31651b2c0e81dce0c7c`. Hub immutable package source and SHA256 from #184.

## Objective
Use portable `oauth-protocol` token handlers in the original Stripe MCP
service in disposable CI only. Preserve Stripe-owned default confidential
HTTP Basic registration, owner login UI, PKCE approval, exact TEST account,
and durable SQL refresh lock/rotation. Do not import portable OAuth code in
running Production or accept a published-package claim from the private pack.

## Acceptance
Service-owned `createStripeOAuthProtocolAdapter` explicitly injects
source registration/authorization handlers, durable Stripe SQL, a
TEST-only scoped authorization-code mapper, and an atomic refresh-result
mapper. Reject missing or changed stored account/profile/mode/client ID.
Temporary source OAuth module stage under checksum-verified installed
private core runs original owner/login/PCKE unit assertions and genuine
original OAuth MCP SDK localhost HTTP/PostgreSQL tests; sidecar is removed
in finally. Original package, actual one-time, profile and bearer proofs
remain full DB CI prerequisites. Preserve money consent/idempotency and
all seven exact-head CI checks. No provider money/credentials/deploy.

## Drift
Core default confidential registration is POST; source defaults BASIC.
Core refresh expects generated token triplet in the durable return row;
Stripe SQL preserves selected settings but omits those token fields.
Do not guess/overwrite these differences; keep original registration
and wrap only durable refresh with server-produced token proof.
