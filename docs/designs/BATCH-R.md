# Design — Batch R: Hub-ready doors (Robinson Tool Contract, RTC 1)

Status: **APPROVED** (Chris, 2026-10-10, IN-00; amended the same day — see "Amendments"). Scope and acceptance:
`docs/PLAN.md` → Batch R. Cards R-1 … R-3. Depends on Batches B and C.

Chris (2026-10-10) chose this architecture: each service gets its own solid, hosted server (Google Workspace MCP, this
Stripe MCP, later Vercel, Neon, GitHub, …), and **Robinson's Toolkit** (`Robinson-AI-Systems/robinsons-toolkit-hub`, the
hub) combines them into one MCP, CLI and HTTPS API for any AI agent, wherever it runs. So this server provides only the
doors every server provides under the **Robinson Tool Contract** (RTC 1, authority:
`https://github.com/Robinson-AI-Systems/robinsons-toolkit-hub/blob/main/docs/CONTRACT.md`): passes, the HTTPS tool API and the
contract manifest. The `rtool` CLI, code SDK, local MCP, GitHub relay and agent setup recipes are built **once**, in the
hub (its Batch D), for every server. The first version of this batch is archived in
`docs/archive/batch-r-v1/BATCH-R.md` and is the starting point for the hub's designs.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| R1 | `stripe_call` dispatches through wrapped handlers (C-2) | `grep -n "stripe_call" src/core/meta.js src/tools/*.js \| head` |
| R2 | The contract version this card targets is still RTC 1 | read the hub's `docs/CONTRACT.md` header; if newer, implement the newest and note it |
| R3 | The hub's conformance package exists (hub card K-2) | look for `packages/conformance` in the hub repo; if not yet, R-3 waits and R-1/R-2 proceed |

## 1. Decisions

**R1. Passes** (RTC §2): `oauth_tokens.kind = 'pass'`; created only by Chris with `stripe_create_pass` (confirm) or the
setup page; shown once on the one-time-secret page (A10), never in chat. Defaults: test mode, `read_only`, 24 hours,
`allow_writes` false, money limit $0, all areas. Writes, live mode, a money limit, chosen areas and a longer life (≤30
days; ≤365 days only for a pass marked "for Robinson's Toolkit") are explicit choices; live + writes also needs the
setup-page passphrase. Passes are listed by `stripe_list_connections` and revoked by `stripe_revoke_connection`.

**R2. HTTPS tool API and manifest** exactly as RTC §1 and §7: `GET /api/contract` (no auth), `GET /api/whoami`,
`GET /api/tools`, `GET /api/tools/{name}`, `POST /api/tools/{name}`, `POST /api/tools/_batch`, `GET /api/results/{handle}`;
pass-only auth; the RTC result envelope and error codes; rate limit per pass, **shared across serverless instances**
(review finding on the Workspace server, 2026-10-10): a Postgres `rate_limits (key, window_start, count)` table updated
with one atomic `INSERT … ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1 RETURNING count`,
one-minute windows, starting limit 120 calls/minute per pass (a stored setting); over the limit → HTTP 429 with
`Retry-After` and error code `rate_limited`. Never an in-memory counter (each Vercel instance would count separately). `GET /api/openapi.json` (generated, ≤30
operations: meta tools, whoami, workflows) for HTTP-only agents.

**R3. Conformance in CI, never a blocker.** When the hub's `packages/conformance` exists it runs against a locally
started server (fake Stripe) in this repo's CI and a failure fails `ci`. Until then this server's own write-contract
tests over MCP, `stripe_call` and HTTPS cover the same behavior; nothing here waits on the hub. Agents use this server
without the hub through its connector, its HTTPS API, or the hub repo's `rtool` CLI and GitHub relay, which talk to this
server directly.

**R4. Contract code lives in `src/core/`** (see Batch A amendment): passes, HTTPS doors, manifest, meta-tools, result rules,
write layer, error envelope. The hub extracts it into the shared package `robinson-mcp-core` (hub card K-3); this server
then switches to the package (a card in that batch).

## 2. Schema

```sql
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS allow_writes BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS money_limit_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS areas TEXT[];
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS for_hub BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS rate_limits (key TEXT NOT NULL, window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (key, window_start));
```

## 4. Work units

### R-1 — Passes (M, medium effort)
Tests: shown once; expired → `pass_expired`; revoked → `pass_revoked`; read-only pass cannot write through `stripe_call` or
HTTPS; money limit $0 by default; 365-day life only with `for_hub`.
### R-2 — HTTPS tool API, manifest, OpenAPI (M)
Tests: write-contract helper through HTTPS (door #3); envelope and error codes per RTC §7; manifest counts match the
registry; OpenAPI valid with ≤30 operations; connector tokens and no token refused on `/api/tools`; rate limit
database test with two independently created handler instances sharing one pass's limit (the 121st call in a minute
gets 429 from either instance); old windows are cleaned up.
### R-3 — RTC 1 conformance in CI (S)
Done when: the hub's conformance package passes in this repo's CI against a local server with fake Stripe.

## 5. Stop-and-ask points

1. The contract and this design disagree: the contract wins; amend this design in the same PR.

## 6. Acceptance mapping

| PLAN Batch R line | Evidence |
|---|---|
| Passes per RTC §2 | `tests/unit/passes.test.js` |
| HTTPS API per RTC §1/§7, same guards | write-contract through HTTPS |
| RTC 1 conformance | CI job `conformance` |

## Amendments

**2026-10-10 — CLI, SDK, local MCP, GitHub relay and recipes moved to Robinson's Toolkit (Chris).** Former cards R-3
(`rstripe` CLI), R-4 (GitHub relay) and R-5 (agent recipes) are now the hub's Batch D, built once for all servers. This
batch keeps passes and the HTTPS doors and adds conformance. `stripe_create_sandbox_pass` is renamed `stripe_create_pass`
to match RTC §2. IN-07 (relay repository) moves to the hub's owner inputs.
