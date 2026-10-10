# Design — Batch A: Foundation (repo, tests, login, key store, Stripe client)

Status: **APPROVED once IN-00 is answered** (Chris approves the plan). Written 2026-10-10 by Claude (Opus 5.5) for an
empty repository. Scope and acceptance: `docs/PLAN.md` → Batch A. Cards A-1 … A-6.

## 0. Verify before starting

| # | Assumption | How to check |
|---|---|---|
| A1 | The Google Workspace MCP files to copy exist at `36b2b63` (2026-10-02) or later `main`: `api/oauth/{authorize,register,token}.js`, `api/well-known/*.js`, `src/oauth/{helpers,login-guard}.js`, `src/crypto.js`, `src/once.js`, `src/changelog.js`, `src/tools/{write,util,errors}.js`, `scripts/check-writes.mjs`, `test/helpers/{fake-db,pg-neon-adapter}.js`, `test/contract/db-contract.js`, `.github/workflows/ci.yml` | `git clone --depth 1 https://github.com/Robinson-AI-Systems/google-workspace-mcp /tmp/gw && ls` those paths |
| A2 | The newest `stripe` npm library pins an API version (at writing: `stripe@23.0.0` → `2026-09-30.endive`) | `npm view stripe version`; `grep -rh "ApiVersion =" node_modules/stripe/esm/apiVersion.js` |
| A3 | Stripe publishes its OpenAPI description for that version (`github.com/stripe/openapi`, file `openapi/spec3.json`, tagged by version) and the `stripe-mock` release binary on GitHub | open both on GitHub; record the tag in the PR |
| A4 | Neon's serverless driver and `@modelcontextprotocol/sdk` install under Node 20 | `npm i` in A-1 |

If any row is false, stop and report; the design may need amending.

## 1. Decisions (made — do not re-open)

**A1. A separate, hosted server, built like the Workspace MCP.** Reason: Stripe moves money; it needs the Workspace
server's preview/confirm/read-back/change-log discipline, hosted so it works from Chris's phone. Robinson's Toolkit's
`stripe` namespace stays as it is until Batch X decides its future.

**A2. Copy, don't reinvent.** The files in row A1 are copied with Google parts removed. First line of each copied file:
`// Copied from google-workspace-mcp <path> @ <commit>`. Fixes to them here do not flow back automatically; a ROADMAP
line notes any fix worth porting.

**A3. Keys live encrypted in Neon; there is no plain copy and no fallback.** `TOKEN_ENCRYPTION_KEY` is required. Without
it the setup page refuses to store a key and every tool returns a plain message saying what to set. (The Workspace server
kept a plain copy during a migration; this server never has one.)

**A4. A Stripe key never passes through Claude.** Keys are added only on `api/stripe/setup.js`, a server page behind the
same passphrase and lockout as the connector login. No tool takes a key argument; no result, log, change-log row or test
contains one.

**A5. Restricted keys recommended; one key per purpose.** The MCP's keys are separate from the Appliance Desk app's key,
so revoking one never breaks the other. `docs/DEPLOY.md` (A-6) lists three recommended MCP keys: **Read only**,
**Everyday** (write: customers, payment intents, refunds, Checkout sessions, payment links, billing portal, subscriptions,
invoices, invoice items, credit notes, products, prices, coupons, promotion codes, webhook endpoints, files; read:
everything else), **Full** (all). Stripe sandboxes are separate accounts with their own test keys and are added the same way.

**A6. Each connection is bound to one account, one mode, one profile and one listing mode**, chosen at login. Mode
`test` is the default and the only mode offered until `live_enabled` is true for that account (Batch B). Profiles
(`read_only`, `everyday`, `full`) and listing modes (`catalog`, `compact`) are defined in Batch B and Batch C; A stores
them.

**A7. The Stripe API version is pinned in code** (`STRIPE_API_VERSION` in `src/stripe/client.js`), set to the version the
installed library ships with. Moving it is its own card with a changelog review (see FINDINGS-style breakage in
`docs/audits/2026-10-10-existing-stripe-code.md`, bugs 1–3).

**A8. Every Stripe write carries an idempotency key:**
`rmcp_<tool>_<sha256(account, mode, tool, canonical JSON of args without dryRun/confirm/fields/detail)>_<10-minute
bucket>`, optionally replaced by a caller's `requestKey`. A retried call returns Stripe's original answer instead of a
second charge.

**A9. Previews never hold a live key.** On any non-production deployment the setup page refuses `sk_live_`/`rk_live_`
and the client refuses to construct a live client (`VERCEL_ENV !== 'production'`), mirroring Appliance Desk's
`assertPreviewStripeKey`.

**A10. One-time secrets are shown on the setup page, never in chat.** A table `one_time_secrets` holds encrypted secrets
Stripe returns once (webhook signing secrets, Batch G; sandbox passes, Batch R). A tool returns a link to
`/api/stripe/setup?show=<id>`; behind the passphrase, the page shows the secret once, for 10 minutes, then deletes it.

## 2. Schema (additive; A-2 creates these, later batches add their own)

```sql
CREATE TABLE IF NOT EXISTS stripe_accounts (
  id TEXT PRIMARY KEY,                 -- Stripe acct_… (never committed to the repo)
  label TEXT NOT NULL,                 -- "Appliance Rentals"
  business_name TEXT,
  test_key_enc TEXT, live_key_enc TEXT,
  test_key_kind TEXT, live_key_kind TEXT,          -- 'restricted' | 'secret'
  test_key_last4 TEXT, live_key_last4 TEXT,
  key_permissions JSONB,                            -- probe result per mode (A-5)
  live_enabled BOOLEAN NOT NULL DEFAULT FALSE,      -- Batch B decides how it turns on
  money_limit_cents INTEGER NOT NULL DEFAULT 50000, -- IN-05
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  key_checked_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS oauth_clients (client_id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS oauth_codes (code TEXT PRIMARY KEY, client_id TEXT NOT NULL, data JSONB NOT NULL,
  stripe_account TEXT, mode TEXT NOT NULL DEFAULT 'test', profile TEXT NOT NULL DEFAULT 'everyday',
  listing TEXT NOT NULL DEFAULT 'catalog', expires_at TIMESTAMPTZ NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_tokens (token_hash TEXT PRIMARY KEY, client_id TEXT, refresh_hash TEXT,
  stripe_account TEXT, mode TEXT NOT NULL DEFAULT 'test', profile TEXT NOT NULL DEFAULT 'everyday',
  listing TEXT NOT NULL DEFAULT 'catalog', kind TEXT NOT NULL DEFAULT 'connector',  -- 'pass' added in Batch R
  expires_at TIMESTAMPTZ, last_used_at TIMESTAMPTZ, revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS login_attempts (id BIGSERIAL PRIMARY KEY, ip TEXT NOT NULL, attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(), success BOOLEAN NOT NULL);
CREATE TABLE IF NOT EXISTS change_log (id BIGSERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now(),
  stripe_account TEXT, mode TEXT, connection TEXT, tool TEXT NOT NULL, target TEXT, summary TEXT NOT NULL,
  before JSONB, after JSONB, dry_run BOOLEAN NOT NULL DEFAULT FALSE,
  amount_cents BIGINT, currency TEXT, direction TEXT, idempotency_key TEXT, inverse JSONB, undone_by BIGINT);
CREATE TABLE IF NOT EXISTS one_time_secrets (id TEXT PRIMARY KEY, stripe_account TEXT, mode TEXT, kind TEXT NOT NULL,
  ciphertext TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ NOT NULL, viewed_at TIMESTAMPTZ);
```

Tokens are stored hashed (SHA-256), not as the Workspace server's plain values — a small improvement A-3 makes while
copying.

## 3. Shared primitives

```js
// src/stripe/client.js — the only file that imports 'stripe'
export const STRIPE_API_VERSION = '<pinned>';
export function makeStripeClient({ key, mode }): Stripe;                 // refuses live keys off production (A9)
export function idempotencyKey(ctx, tool, args): string;                 // A8
export async function listAll(listFn, params, { max = 1000 }): { items, capped: boolean };
// src/keys.js
export async function storeKey({ account, mode, key }): { account, mode, kind, last4, permissions };
export async function loadKey({ account, mode }): string;               // decrypt per request; never cached across requests
export async function probePermissions(stripe): Record<area, 'ok' | 'denied'>;
```

## 4. Work units (in order)

### A-1 — Repository, test harness, CI and doc checks
Files: `package.json`, `.github/workflows/ci.yml`, `vitest.config.js`, `scripts/{check-secrets,check-docs-updated,check-writes,check-budgets}.mjs`
(budgets/writes start as stubs that pass on an empty registry **and say so in their output**; they become real in B-7 and C-2 —
a check that passes trivially on zero tools is not a placeholder, it is correct for zero tools), `scripts/local-postgres-test.sh`,
`scripts/stripe-mock.sh`, `test/helpers/{fake-db,pg-neon-adapter}.js`, `test/contract/db-contract.js`, `test/helpers/fake-stripe.js`
(its exact API is in `docs/pr-cards/A-1.md`), `README.md` (short, points to `docs/START-HERE.md`).
Tests: fake-stripe records calls and idempotency options; secret scan fails on a planted `sk_live_` string (prove, remove).
Done when: `npm run check`, `npm test`, `npm run test:db`, `npm run test:mock` pass locally and in CI; a deliberately failing
test turns CI red once.

### A-2 — Database schema
Files: `src/db.js` (all SQL; `initSchema()` idempotent), fake and contract updated.
Tests: contract against fake and Postgres; `initSchema()` twice changes nothing.

### A-3 — Connector login (account, mode, profile, listing)
Files: `api/oauth/*`, `api/well-known/*`, `src/oauth/*`, `api/mcp.js` (lists zero tools until B; home page `api/index.js`
prints counts).
Change: port the Workspace flow; authorize page shows account dropdown, mode (test only unless `live_enabled`), profile,
listing, passphrase. Hash tokens.
Tests: 5 wrong passphrases in 15 minutes lock the address; a forged `mode=live` post is refused when not enabled;
refresh only for the same client; revoked tokens refused; tokens stored hashed.

### A-4 — Stripe client wrapper and OpenAPI index
Files: `src/stripe/client.js`, `vendor/stripe-openapi/<version>.json` (downloaded from Stripe's repo at the matching tag,
with `vendor/stripe-openapi/SOURCE.md` naming URL and tag), `scripts/openapi-find.mjs` (prints matching operations: method, path,
summary, ≤20 lines).
Tests: same args → same key; `dryRun/confirm/fields/detail` don't change it; `requestKey` does; `listAll` stops at the cap and says
so; stripe-mock accepts `subscriptions.create` with `items: [{ price, quantity: 2 }]` (regression for audit bug 4); a grep test
proves only `src/stripe/` imports `stripe`; a live key off production throws.

### A-5 — Encrypted key store, setup page, one-time secrets
Files: `api/stripe/setup.js`, `src/keys.js`, `src/one-time-secrets.js`, `src/tools/server.js` (`stripe_whoami`,
`stripe_list_accounts` only, read-only).
Change: paste key → `GET /v1/account` → probe permissions (one harmless list per area) → store encrypted; show last 4.
Tests (fake keys only): stored value is ciphertext; wrong encryption key gives a plain error, never the key; a test scans
every tool result and change-log row the whole unit suite produced for key-shaped strings and fails if any appear;
one-time secret shown once then gone; live key refused off production.

### A-6 — DEPLOY.md (docs) `[light effort]`
Files: `docs/DEPLOY.md`.
Change: Vercel project, Neon database, env vars (`DATABASE_URL`, `ADMIN_PASSPHRASE`, `PUBLIC_BASE_URL`,
`TOKEN_ENCRYPTION_KEY`), generating the encryption key, the three restricted keys with exact permission lists, adding them on
the setup page, adding the connector in claude.ai (test mode first).
Done when: a reviewer pretending to be Chris can follow it without a question.

## 5. Stop-and-ask points

1. Any row of section 0 false.
2. Stripe's restricted-key permission names differ from A5's list: correct the list from Stripe's dashboard docs, cite it.
3. Anything requiring a paid Vercel/Neon plan (IN-02).

## 6. Acceptance mapping

| PLAN Batch A line | Evidence |
|---|---|
| CI with all checks | A-1 CI run |
| Login, lockout, hashed tokens, mode/profile binding | `tests/unit/oauth*.test.js` |
| Keys encrypted, never exposed | `tests/unit/keys.test.js`, key-scan test |
| Pinned version, idempotency, nested params | `tests/unit/client.test.js`, `tests/mock/client.test.js` |

## Amendments

(Dated entries only.)
