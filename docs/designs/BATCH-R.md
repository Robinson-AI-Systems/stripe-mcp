# Design — Batch R: Reach any agent (HTTPS API, `rstripe` CLI, code mode, GitHub relay)

Status: **APPROVED once IN-00 is answered.** Written 2026-10-10. Scope and acceptance: `docs/PLAN.md` → Batch R.
Cards R-1 … R-5. Depends on Batches B and C.

Chris (2026-10-10): agents that can't use the connector should be able to use this from wherever they run; "come up with
a solution more than … follow my specific request." The deciding fact is **network access**: most cloud agent workspaces
(Claude's own workspace, Claude Code on the web, Codex cloud, GitHub's coding agent, CI) block the open internet and allow
only GitHub and package registries. That is why Chris's small GitHub push/pull tool worked there. So: **one engine on the
hosted server, thin doors to it, and one small client that finds its own way out.** The Stripe key never leaves the server.

| Where the agent runs | Typical reach | Door |
|---|---|---|
| claude.ai / Claude apps | remote connectors | `/api/mcp` |
| Cloud agent workspaces | shell; GitHub + registries only | `rstripe` over the **GitHub relay** |
| Local machines (Claude Code, Codex CLI, Cursor, Claude Desktop) | shell, internet, local MCP | `rstripe mcp` (local stdio MCP) or `rstripe` direct |
| General sandboxes (Vercel Sandbox, E2B, Docker, VPS) | whatever the creator allows | `rstripe` direct (allow-list the server, GitHub, npm) |
| HTTP-only agents (custom GPT actions, n8n, Zapier) | HTTPS, no shell | `/api/tools/*` + OpenAPI |

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| R1 | `stripe_call` dispatches through wrapped handlers (C-2) | `grep -n "stripe_call" src/tools/meta.js` |
| R2 | GitHub issue comments can be created, listed and deleted with a fine-grained token limited to one repository | GitHub REST docs "Issue comments"; record the permission names |
| R3 | The relay repository exists and is private (IN-07) | `gh repo view Robinson-AI-Systems/stripe-mcp-relay --json visibility` |

## 1. Decisions

**R1. Sandbox passes** (`oauth_tokens.kind = 'pass'`): made only by Chris (`stripe_create_sandbox_pass`, confirm; or the
setup page), shown once through the one-time-secret page (A10). Defaults: test mode, `read_only`, 24 hours, writes off,
money limit $0. Writes, longer life (≤30 days), live mode and a money limit are each chosen explicitly; live + writes also
needs the setup-page passphrase. Listed in `stripe_list_connections`; revocable instantly.

**R2. Plain HTTPS API:** `GET /api/tools?q&area`, `GET /api/tools/{name}`, `POST /api/tools/{name}`,
`POST /api/tools/_batch`, `GET /api/results/{handle}`, `GET /api/openapi.json` (generated; ≤30 operations: meta tools,
whoami, workflows). Bearer = pass. Rate limited per pass.

**R3. `rstripe`** (`packages/cli`, plain JS, Node 20+, no build step), installed with
`npm install -g github:Robinson-AI-Systems/stripe-mcp#cli-v1` or `npx -y github:…#cli-v1 <cmd>`. Commands: `init` (write the
agent's skill/AGENTS.md files, report the route), `login` (OS keychain on local machines), `whoami`, `tools [words]`,
`describe <tool>`, `call <tool> --args '{…}'` (`--fields`, `--detail`, `--out file` prints a one-line summary and keeps the
full result in the file, `--dry-run`, `--confirm`), `result <handle>`, `sdk` (typed functions per area, for code mode),
`mcp` (local stdio MCP, compact listing), `skill` (prints SKILL.md ≤600 words), `engine` (test keys only, refuses live keys).
Exit codes: 0 ok, 2 needs confirm, 3 refused by a guard, 4 Stripe error, 5 pass expired, 6 no route.

**R4. Route finding:** try `RSTRIPE_URL` directly; if the proxy refuses or the connection fails, switch to the GitHub relay and
say so once. Respect `HTTPS_PROXY` and the system certificate bundle.

**R5. GitHub relay:** private repo `Robinson-AI-Systems/stripe-mcp-relay`, one issue per pass. The CLI encrypts the request
with a key derived from the pass (HKDF-SHA256 → AES-256-GCM; the pass never goes to GitHub), posts it as a comment with a
request ID; GitHub's signed webhook reaches `api/relay/github.js`; the server decrypts, runs the tool through the registry,
encrypts the result, posts a reply; the CLI polls, decrypts, prints and **deletes both comments**. Hourly cleanup deletes any
relay comment older than one hour; the issue closes when the pass expires or is revoked. Issues, not commits, so nothing
enters git history. The agent's GitHub token needs access to the relay repo only.

**R6. Code mode:** `rstripe sdk` writes `stripe-tools/<area>.js` with one typed function per tool in the pass's profile;
writes still need `confirm: true` and a pass with writes; the money limit stops runaway loops server-side.

## 2. Schema

```sql
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS allow_writes BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS money_limit_cents INTEGER NOT NULL DEFAULT 0;
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS areas TEXT[];
ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS relay_issue INTEGER;
CREATE TABLE IF NOT EXISTS relay_seen (request_id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, seen_at TIMESTAMPTZ NOT NULL DEFAULT now());
```

## 4. Work units

### R-1 — Sandbox passes (M, medium effort)
Tests: shown once; expired → `pass_expired`; read-only pass cannot write through `stripe_call`; money limit $0 by default.
### R-2 — HTTPS API and OpenAPI (M)
Tests: write-contract through HTTP (door #3); OpenAPI valid, ≤30 operations; connector tokens and no token refused.
### R-3 — `rstripe` CLI, SDK, local MCP, skill, engine (L)
Tests: every command and exit code against a local server with fake Stripe; `--out` prints one line; SDK compiles
(`tsc --noEmit` on the generated `.d.ts`) and a sample script runs; `rstripe mcp` passes an MCP client smoke test; `engine`
refuses live keys; write-contract through the CLI (door #4).
### R-4 — GitHub relay (L, medium effort)
Tests with a fake GitHub API: round trip; comment bodies are ciphertext; both comments deleted; bad webhook signature
ignored; revoked pass refused; replayed request returns the original result (`relay_seen` + idempotency); write-contract
through the relay (door #5). One real run from a GitHub-only cloud workspace: `init` reports "relay", `whoami` and one read work.
### R-5 — Agent setup recipes and real runs (M)
Files: `docs/AGENT-SETUP.md` (Claude Code local/web, Claude's workspace, Codex CLI/cloud, Cursor, Copilot coding agent,
GitHub Actions, Vercel Sandbox with an allow-list, Docker; plus a paste-in paragraph), `scripts/agent-check.mjs`.
Done when: `agent-check` is green in a local machine (direct), a cloud workspace (relay) and a Vercel Sandbox (direct; a
`curl https://api.stripe.com` from inside is blocked); passes revoked afterwards.

## 5. Stop-and-ask points

1. R2 false (GitHub cannot scope a token to one repo for issues): amend the relay to a dedicated GitHub App installed on the
   relay repo only.
2. Creating the relay repo or giving an agent account access (IN-07).

## 6. Acceptance mapping

| PLAN Batch R line | Evidence |
|---|---|
| Five doors, same guards | write-contract in `tests/doors/` |
| No key leaves the server; relay sees only ciphertext | R-4 tests + key-scan test |
| Works in three real places | R-5 PR output |

## Amendments
