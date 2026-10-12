# R-4r — Original Stripe MCP dispatch and K-3 service authentication boundary

Status: IMPLEMENTED; #190 CI, review, merge and exact-main checks pending.
Baseline source `8af1ad47014c90b3a1d1ac9adb1eda5a8c0b1efe`.
Hub archive immutable from #184, SHA256 `3038f7664e18ac57e5fdb86daf0884f603a78a446e2f1300f20fd59a92e73ea6`.

## Capability
Harden the actual Stripe source dispatcher: own data-property tool-name
selection, own function handler slot (never Object.prototype inherited),
inert getter-free args and frozen tenant identity before asynchronous
handler policy, no nested read-to-write escalation, source error/redactor
and scoped result storage unchanged.

## Independent acceptance
In disposable CI, temporarily rewire only direct dispatch to the
checksum-verified PRIVATE core mcp-dispatch adapter. Preserve original
Streamable HTTP MCP SDK, OAuth/PKCE, source-selected TEST account/profile,
source registry metadata, result owner/scoped SQL persistence, redaction
and tool error formatting. Execute unchanged original service unit and real
localhost HTTP/disposable PostgreSQL suites, with source restoration in finally.
All seven exact-head GitHub gates and reviews still mandatory.

## Distinct prerequisites
Hub final release and version/tag/remote immutable asset, and
genuine deployed owner TEST OAuth/provider reads and Hub D-4 route/revocation
remain externally unverified. Re-enter each after its exact evidence source
becomes available; independently eligible Stripe roadmap work must continue.
LIVE off, independent transaction-specific money-out approval and $500/account
Denver-calendar-day cap plus distinct override unchanged. No runtime private dependency.

## Source-guarded meta-route distinction
The private core currently denies any nested write. Original Stripe explicitly
allows a single independently guarded TEST write through `stripe_call`,
but not through `stripe_batch`. The source unit suites discovered this real
behavior difference; the service adapter deliberately retains both original
hardened meta routes instead of substituting an incompatible nested-call
implementation. Complete portable source-equivalent meta dispatch only in a
separate tested implementation; no owner money gate, account isolation,
idempotency or test assertion was weakened to force compatibility.
