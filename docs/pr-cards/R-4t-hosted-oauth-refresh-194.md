# R-4t — opt-in production-revision-pinned original OAuth refresh (#194)

Status: IN REVIEW, exact-head CI and self-review pending.
Baseline: 1aef9e8fc773538d21bfe993364dce1961d0e703; predecessor #193 standalone SDK probe merged.
Approved A/R OAuth TEST external acceptance and existing source-authority rules.

## Drift A
| Assumption | Verified source | Change |
| --- | --- | --- |
| #181 local OAuth SQL/SDK tests are hosted refresh evidence | All run on disposable local PostgreSQL and fake accounts | Owner-only hosted real remote refresh path |
| #193 service SDK probes handle refresh | Existing code only checks a supplied bearer and a separately revoked token | Verify actual service-owned token POST and changed access scope |
| A remote refresh can be safely retried | Original `rotateRefreshToken` atomically consumes refresh | Single no-retry POST; record ambiguity, require owner revocation |

## Scope and acceptance
- Explicit `--owner-approved-test-refresh` and protected `MCP_OAUTH_*`/RTC env only; never automatic scheduled execution.
- Pinned trusted origin and actual `live` SHA checked before bearer/refresh use.
- Check existing exact read_only TEST account via official MCP SDK (#193), then perform one source OAuth refresh; validate newly issued bearer/refresh are distinct.
- Verify new bearer keeps the same account/TEST/read_only through SDK, and old access token returns genuine service `401 invalid_token`. No retry of single-use refresh.
- Return only PASS/FAILED stages without credentials, provider bodies or client ID; owner must revoke newly rotated TEST session in private setup after test, even on error.
- Tests for SHA drift, SSO, invalid inputs, source refresh failure, provider scope mismatch, replay denial, no output secrets. PR exact-head seven checks required.
- No OAuth interactive PKCE or Dashboard, webhook, provider read or Hub D-4 claim.
