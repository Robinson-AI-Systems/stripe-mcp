# A-3g — real HTTP/isolated SQL OAuth-to-MCP SDK wire acceptance (#181)

Status: MERGED (#181) as-if; **do not treat as merged until exact-head seven checks and review gate pass**.
Baseline inspected: 4fedb344c732b806dae033f87e936350a1180b77 (#180).
Scope: existing approved A-3 custom OAuth, G-6 TEST acceptance and MCP connector transport. No new API, production migration, Stripe call, external credential or deployment.
Risk boundary: OAuth S256 public-client authorization, scoped MCP read-only transport, atomic refresh, denial and revocation.

## Drift A

| Assumption | Actual at inspected main | Change |
|---|---|---|
| OAuth handlers have correctness regressions | tests/unit/oauth-handlers.test.js has handler-only fake-DB coverage | Preserve; add real PostgreSQL and localhost HTTP with SDK client |
| SQL token rotation is covered | tests/db/oauth.test.js and oauth-auth-wire.test.js separately exercise rotation and bearer | Add cross-boundary registration → authorization → token → actual MCP client read → refresh → revoke |
| OAuth end-to-end is live-accepted | No independently authenticated external client evidence | Keep genuine custom-MCP hosted acceptance UNVERIFIED |
| Hosted current revision is reachable | live=8068f52, main=4fedb344 and historical main READY | Do not issue pass, promote, bypass SSO or claim deploy |

## Implemented test contract

- `tests/db/oauth-real-mcp-wire.test.js`: ephemeral localhost HTTP server wraps the actual OAuth route handlers and the real MCP SDK server; official MCP SDK client invokes `tools/list` and `stripe_whoami`. Isolated disposable PostgreSQL stores fake TEST keys, hashed public-client auth code, access and refresh credentials.
- Tests exercise GET owner page and explicit TEST choice, correct state, S256, single-use auth code, forbidden LIVE request, secretless public client, limited read-only tool surface, exact selected account and no foreign account, refresh scope/old-token/replay denial, owner token revocation and refusal of revoked refresh/token.
- Tests never call Stripe, authorize real provider mutation, authenticate an external client, access protected Production or use an owner secret. They must not be reported as genuine hosted OAuth/PKCE acceptance.
- Existing `npm run check`, all unit, mock, DB, upstream RTC fixture and target-main gates remain mandatory. DB test job is the meaningful execution environment; REST edits do not execute local tests.

## Acceptance / successor

- Success requires **seven** check/unit/db/mock/rtc-reference/ci/target-main SUCCESS on exact PR head, no unresolved review thread, self-review and authorized merge.
- Ledger keeps independent statuses for source, real HTTP+SQL local wire, scheduled deployed revision, connected OAuth client, genuine Stripe TEST read, signed webhook and Toolkit Hub direct/relay/Sandbox.
- The next candidate is a demonstrated flaw in those boundaries or an independently eligible approved G-4/G-5/G-6 card; H-1 remains gated by real G-6 owner acceptance. Do not generate a filler PR.
