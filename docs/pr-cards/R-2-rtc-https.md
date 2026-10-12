# R-2 — Owner-approved read-only RTC HTTPS doors (#155)
Status: MERGED as-if; exact-head CI/review required.
Approved Batch R and owner D-4 instructions; reference hub RTC 1,
AGENT-SETUP and D-4 acceptance card.
Drift A: R-1 pass store supports only 24h TEST read_only credentials. No
/api/contract or HTTPS tool door, atomic shared pass limit or fully verified
hub probe exists. Older MCP tool names are not RTC-prefix compliant.
- Add public manifest with explicit pending conformance status and public
  limited OpenAPI; map existing tool names into stripe-prefixed HTTP aliases
  only, retaining original MCP names and handlers.
- GET whoami, search, describe, results; POST direct safe read, ≤10 read-only
  batch through the same registered MCP dispatch/profile guards.
- Authenticate only RTC passes. Recheck active TEST account, expiry, revocation,
  $0 money, no writes; atomically bound usage across serverless processes at
  120/min with 429 rate_limited and Retry-After. Existing owner revocation
  must include kind=pass in both intent and final transaction, and list passes
  without exposing bearer hashes; tests require post-revocation HTTP 401.
- Strong safe envelopes, size/fields/handles from core dispatcher; no pass or
  raw provider payload in errors.
- Unit and real Postgres concurrency tests; run hub's immutable conformance
  reference tests in CI as an upstream guard, and preserve remaining genuine
  service-conformance gap as explicit not passed.
- No OAuth/MCP auth change, Stripe write, money, LIVE or third-party project
  change. Hub real direct/relay/sandbox tests need short-lived owner passes and
  actual route connectivity plus immediate revocation.
Drift B: docs STATUS, ARCHITECTURE, owner guide, GO-LIVE and applicable CI.
Next: full RTC write-contract coverage, conformance against service URL in
isolated environment, three owner-authorized genuine D-4 routes, ingress gates.
