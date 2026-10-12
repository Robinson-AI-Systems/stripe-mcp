# A-3f — OAuth connector bearer wire interoperability + real SQL isolation (#178)

Status: MERGED (#178) as-if; do not treat as merged until exact-head seven-job gate and review pass.
Design: A-3 OAuth 2.1/PKCE read_only connector, RTC contract §2 and D-4 separate bearer doors.
Prerequisites: #177 merged main 57703a29e98c776015c751b6b3d8130fa831fd58.
Baseline inspected: 57703a29e98c776015c751b6b3d8130fa831fd58.
Risk: connector authentication only; no migration, money, Stripe provider API or write.
Budget: small tightly scoped boundary fix plus independent DB/HTTP regression.

## Read only these
AGENTS hard limits, SESSION-START, DRIFT-PROTOCOL A/B, src/core/mcp-auth.js,
src/core/oauth-handlers.js token/refresh methods, src/db.js token methods,
tests/db/oauth.test.js, tests/db/oauth-persistent.test.js,
docs/HOSTING-COST-POLICY.md and docs/acceptance/STRIPE-TEST-MILESTONE.md.

## Drift check A
| Assumption | Actual | Kind | Correction |
| --- | --- | --- | --- |
| All standard HTTP Bearer scheme casing accepted by OAuth MCP | src/core/mcp-auth.js /^Bearer / was case-sensitive | Authentication interoperability | Case-insensitive scheme name only; enforce exact token bytes |
| RTC pass cannot be used at OAuth MCP door | Database getAccessToken requires kind connector but no actual HTTP/SQL test of mixed casing and replay | Security regression | Isolated PG loopback tests for RTC pass denial and altered token |
| OAuth refresh retains account/test/read_only and revocation | Existing unit and DB direct tests, no actual HTTP auth after refresh | Evidence gap | Real HTTP authenticated scope/account snapshot after atomic refresh, old/revoked refused |
| Connected external custom MCP confirmed | No owner authenticated external OAuth yet | Acceptance | Keep external separate, never mark hosted OAuth PASS |

## Build contract and tests
- src/core/mcp-auth.js: RFC bearer-scheme case-insensitive regex; no changes to token validation,
  protected resource challenge, kind, account/profile/mode checks or /api/mcp SDK semantics.
- tests/db/oauth-auth-wire.test.js: real localhost HTTP auth listener + isolated
  PostgreSQL token data, case alternatives, token-byte alteration, RTC denial, scope preservation,
  rotation/replay, revocation. The listener targets the real requireMcpToken boundary,
  not full SDK request serialization: connected MCP OAuth end-to-end remains unverified.
- Validate seven exact-head check/unit/db/mock/rtc-reference/ci/target-main and all review threads,
  then protected merge; update STATUS in same PR. Existing provider/live/spend gates unchanged.

## Next
Verify full external custom MCP OAuth+PKCE /api/mcp connected read, provider TEST
and signed webhook where protected deployed host/owner credentials permit.
When SSO or checked daily promotion blocks, record precise dependency and
continue separate substantive approved work, never manufacture PR slots.
