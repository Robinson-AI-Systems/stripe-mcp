# R-4s — externally authorized standalone custom-MCP bearer SDK check (#193)

Status: IN REVIEW, exact-head CI pending.
Baseline: ecb0b605c3e746f22ed3d8f691177ca31fc44767. PR #192 merged, current `live` behind main.
Design: approved RTC 1 + OAuth owner TEST acceptance, `docs/PLAN.md` A/R.
Risk: opt-in owner-only remote read script; no migrations, money or provider writes.

## Drift A
| Prior assumption | Observed | Action |
| --- | --- | --- |
| Local #181 OAuth test certifies deployed client | Disposable PostgreSQL/HTTP with synthetic credential and actual MCP SDK only | Make a protected owner external SDK read runner |
| Existing #177 RTC pass proves OAuth bearer | RTC is a different pass-only HTTPS door | Exercise exact standalone `/api/mcp`, not Hub or RTC |
| Main CI means current live deployed | Production/live revision unverified and behind | Refuse to send bearer until pinned `live` SHA attestation |

## Contract and tests
- Protected process env only, commands `node scripts/hosted-custom-mcp.mjs --connected` and `--revoked`.
- Exact origin, HTTPS live SHA and `/api/mcp` only. Injected SDK fetch forbids cross-origin and redirect, no secrets or account in reports.
- Official installed MCP SDK lists read_only catalog, rejects a write entry, reads local `stripe_whoami` identity matching pinned account/mode/profile.
- After separate owner revocation, test 401 JSON `invalid_token` at standalone MCP, not Vercel SSO/generic 401.
- Fake-fetch unit covers all denial classes; existing #181 real local PostgreSQL/SDK acceptance retained.
- No remote PKCE redirect or refresh-flow proof, Stripe TEST SDK call, webhook receipt or Hub route claimed; these each remain UNVERIFIED.

PR requires all seven exact-head CI checks, self-review and zero unresolved threads.
