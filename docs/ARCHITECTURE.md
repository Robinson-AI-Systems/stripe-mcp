# ARCHITECTURE — runtime facts, as built

This file describes what **exists**, and is updated in the same PR that ships it (DRIFT-PROTOCOL checklist B). What the
system is designed to become is in `docs/designs/`; do not copy design text here before it is built.

As of 2026-10-10: Batch A and the TEST-side trust layer B-1–B-8c2 (#35) are merged. No server, Neon database, live key or real Stripe account is provisioned. Private per-transaction owner TEST approval is implemented; public Stripe write tools and LIVE activation remain disabled (IN-06).

## Infrastructure

| Piece | State |
|---|---|
| GitHub repo `Robinson-AI-Systems/stripe-mcp` | Created 2026-10-10; plan committed |
| GitHub Actions CI | Check + unit + isolated PostgreSQL 17 + stripe-mock v0.202.0; single `ci` gate (A-1, PR #9) |
| Vercel project | Not created (IN-02) |
| Neon database | Not created (IN-02) |
| Stripe keys | None added |

## Environment variables

CI only: `TEST_DATABASE_URL` (must be localhost for DB tests), `BASE_SHA` (docs reconciliation) and `STRIPE_MOCK_EXTERNAL` (CI's disposable mock service). `DATABASE_URL` is now required only when the A-2 production database initializer runs (not at module import); no value is configured. Other deployment variables: none yet. Batch A defines `DATABASE_URL`, `ADMIN_PASSPHRASE`, `PUBLIC_BASE_URL`, `TOKEN_ENCRYPTION_KEY`; record each
here with its environments when A-5 ships. Never record values.

## Database tables

A-2 defined seven tables; B-1 added `money_reservations` and `money_approvals`, and B-2 added `live_enable_intents`. All **fifteen tables** are created **only when `initSchema()` is invoked**. In CI, creation is confined to an isolated throwaway localhost PostgreSQL schema. No real Neon database has been created or migrated.

| Table | Purpose |
|---|---|
| `stripe_accounts` | Per-account labels, encrypted key slots, live-mode gate and money limit |
| `oauth_clients` | Client registrations |
| `oauth_codes` | Expiring one-time login codes and connection scope |
| `oauth_tokens` | Hashed access/refresh credentials and exact account/mode/profile/listing |
| `login_attempts` | Auditable sign-in attempts and future lockout |
| `change_log` | Preview/confirm/read-back audit history and future undo links |
| `one_time_secrets` | Only ciphertext, expiry and single-view record |
| `money_reservations` | Durable, per-account aggregate money-out reservation across ALL AI connections, Denver day, idempotency and conservative spend status (B-1) |
| `money_approvals` | Single-use authenticated owner grant per money-out request, with separate above-limit owner override (B-1) |
| `owner_money_decision_intents` | B-8c2 private TEST-only, short-lived exact provider-derived transaction snapshots; consumed with an atomic owner grant and change-log audit; never agent-facing |
| `live_enable_intents` | Expiring, atomic owner live-enable intent, not usable while IN-06 is OFF (B-2) |
| `owner_revoke_intents` | One-time private owner intent bound to a specific Stripe account and AI connection, expiring after ten minutes; consumed with atomic token revocation and audit (B-8b2a) |
| `owner_disable_live_intents` | Ten-minute owner-only emergency LIVE-disable intent, consumed atomically with a one-way account disable and audit; cannot enable LIVE (B-8b2b1) |
| `owner_default_account_intents` | Ten-minute owner-only account-default choice with expected prior default and one-use confirmation; SQL advisory-locked atomic update and audit (B-8b2b2) |
| `owner_money_limit_intents` | Owner-only exact account cap change with old/new cents, 10-minute expiry, row-locked single-use application and audited before/after; no money grant (B-8b2b3) |

Additive indexes support token expiry, lockout, audits, reservations, approvals and live intents. A-5a adds `src/core/crypto.js` AES-256-GCM authenticated encryption (random nonce, additional authenticated context and no plaintext fallback); `src/keys.js` stores and retrieves test-only Stripe keys server-side in encrypted form, and `src/core/one-time-secrets.js` uses atomic database deletion on reveal. A-5b adds the private owner-only `/api/stripe/setup` endpoint with strict origin/CSRF checks, passphrase lockout, account-verification and permission probes; no real owner key has been entered. Read-only `stripe_whoami` and `stripe_list_accounts` are dispatched through the MCP bearer guard. Writes remain denied until Batch B. `TOKEN_ENCRYPTION_KEY` is required only when these functions execute; it is not configured in any deployment. A-3a added hashed client registration, authorization code consumption, access/refresh rotation, revocation, login lockout and account selection methods. A-3b adds HTTP OAuth endpoints and the connector door; A-5 adds encryption and key handling. Later batches extend schema through their own migrations.

## Endpoints

`/api/stripe/setup` is a dedicated owner-only browser form; raw Stripe keys never enter MCP or tool calls. GET issues a secure 10-minute CSRF cookie; POST requires matching origin, cookie, form token and admin passphrase. One-time secrets appear only after authenticated POST, with an atomic delete. No live credentials are accepted.

A-3b provides `/api/oauth/register`, `/api/oauth/authorize`, `/api/oauth/token`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/api/mcp`, `/api` (status). OAuth access credentials expire after one hour; hashed refresh credentials persist until revocation and rotate on use. The MCP bearer token is not used with Stripe.

## Safety (Batch B in progress)

B-1b2 (PR #20) wires the generic `defineWrite` lifecycle to trusted monetary descriptions, integer USD cents, the atomic daily reservation ledger, confirmation, independent read-back and conservative settlement. Its seven-case contract tests use fake provider records and accept each real write tool's handler/fixtures directly. Confirmed Stripe invalid requests, access denials and card declines release rejected money reservations without replay; unknown/network outcomes retain reserved capacity. The schema's state constraint upgrades once, without dropping records. No AI-controlled approval flag is trusted; every money-out requires a separately authenticated database owner grant. LIVE/app-ownership guards were implemented in B-2/B-3; no money write tool is publicly registered.


B-1b1 adds `money_reservations`, an account-row-locked PostgreSQL function `reserve_money_out_guarded`, and the server-only `reserveMoneyOut`, `getMoneyUsage`, `settleMoneyReservation` database methods. Same request key is never reserved twice, concurrent requests cannot jointly overspend the shared Stripe-account daily limit, and uncertain outcomes never silently return capacity. The accounting cap is USD cents and non-USD attempts return `currency_unsupported` (conservative protection until a verified conversion policy exists). Test fixtures use the owner-approved $500 USD per-account default, but **no money write tool is enabled**. B-1b2 owns the actual money spec, daily enforcement integration and IN-05 decision.


B-1a adds `src/core/write.js` and `src/tools/write.js` for an internal-only TEST-mode preview→confirmation→idempotency→read-back lifecycle and `src/db.js.recordChange` for existing `change_log` audit persistence. **No write tool is registered in the MCP yet; all money operations still fail closed.** B-1b owns daily money-out enforcement; B-2/B-3 add live/app ownership guards before any public write tools.

## Stripe API version

`src/stripe/client.js` pins the official Stripe Node SDK (package lock: v23.0.0) to `2026-09-30.endive`. Keys are passed only from the encrypted store (planned A-5) and never held in this repo. Non-production deployments refuse live keys; test-only transport override cannot be selected by a production request. The exact published Stripe v2556 SDK OpenAPI description is vendored in 23 byte-preserving parts under `vendor/stripe-openapi/` due the GitHub write-size limit. `scripts/stripe-openapi.mjs` checks the reconstructed Git blob SHA-1 `509de1b4510d2c03ad8755d06778c1deb5619c7f`, version and path count before using it. `scripts/openapi-find.mjs` provides capped, read-only lookups and prints the SHA-256 on `--verify`; SOURCE.md preserves provenance.


### Money approvals and shared account budget (IN-05, 2026-10-10)

`money_approvals` stores account, idempotency key, tool, safe human description,
provider-derived USD cents, expiry, owner approval timestamp, single-use consumption,
and a separately authorized over-limit flag plus independent `override_approved_at` timestamp. `money_reservations` is serialized
under the Stripe-account row lock. Its daily sum covers all connections of the
same Stripe account; the owner's approval must be valid and is consumed inside
the reservation procedure. No public or agent-side method can approve a request.
Private TEST-only owner approvals are available in code via the protected setup page after #35, with one-use, transaction-identity-bound decisions and separate above-cap consent. No public money-writing tool or live provider operation is enabled.

### B-2b owner LIVE confirmation intent (IN-06 OFF)

`live_enable_intents` stores a random 32-character server-issued identifier,
account ID, expiration (10 minutes) and consumption. Creating a pending intent
**never enables live mode**. The owner setup route displays that account and
requires the existing protected origin/CSRF/passphrase checks plus an explicit
owner LIVE consent. Even then, `LIVE_MODE_OWNER_APPROVED` defaults OFF. Atomic
PostgreSQL consumption enables `stripe_accounts.live_enabled` only when that
additional IN-06 gate is on and the account has an encrypted live credential;
the same SQL statement records the security change in `change_log`. The MCP
dispatcher still exposes only TEST/read-only tools and cannot approve an intent.

### B-3 application-owned Stripe record guard (staged)

Internal `src/tools/app-guard.js` detects the known Appliance Desk metadata keys from `docs/APP-NEEDS-APPLIANCE-DESK.md` on the target or on its customer. If customer ownership is unknown or cannot be read, writes deny rather than treating the target as unaffiliated. App-owned changes require `outsideApp:true` under the ordinary guarded write contract; app-owned refunds have the documented exception and still require individual authenticated owner money approval. Reads can be marked `appRecord`. This protection is internal; no public write handler is registered yet.

### B-4 safely translated Stripe errors (staged)

`src/tools/errors.js` maps recognized Stripe SDK error classes to plain-English diagnostics and corrective actions, retains only sanitized request IDs/fields, and never returns raw provider messages or secrets. It is integrated in the current read-only MCP handler and guarded Stripe write adapter. Unknown errors preserve previous handling; no additional write door is exposed.

### B-5 result shaping (under review)

Read-only MCP results and guarded Stripe write results are postprocessed by a non-mutating, credential-redacting display layer. Original money minor units remain available with additive currency displays, and Unix timestamps get Denver-local companions. No changes to Stripe permissions or account authorization.

### B-6 connection-profile enforcement (in review)

Every profile's tool discovery and direct name-call gate checks the same declared metadata; write tools are withheld from read_only unconditionally. The currently registered tool surface is still read-only while remaining Batch B gates are implemented. Home endpoint lists actual exposed-tool counts.

### B-7 tool safety declarations (staged)

Every registered tool has an explicit writes:boolean declaration. Money-out risk requires an attached provider-derived money spec and a guarded write contract, enforced by the shared CI write checker. The checker does not infer write status from names.

### B-8a account-scoped read tools (in review)

Change summaries and AI connection metadata are scoped to the authenticated Stripe account, without token hashes or raw snapshots; reads are bounded. Account status reports actual shared daily budget usage. Dashboard guidance is informational and does not change settings. No new money or LIVE permission is exposed.

### B-8b1 TEST read-permission checks (in progress)

The server injects a lazy permission probe into the MCP read dispatcher, loading only the selected account's TEST key after a call. It refreshes verified per-account read-permission status and never exposes/decrypts LIVE credentials. Missing keys fail this tool, not the server startup.

### B-8b1 reviewed key rotation and dispatcher boundaries

MCP core takes a generic server-provided services object. The Stripe-only
TEST permission recheck is assembled at the external API boundary, never
accepted as an agent argument. The encrypted TEST-key snapshot is loaded once
for the call; the database persists verified permission results only if the
account's encrypted key still matches that snapshot (compare-and-set).
Rotated keys fail closed. The read tool supports `fields` and
`detail=compact|full`, with no credentials in either presentation.

### B-8b2a private connection removal (pending review)

The private setup page's origin, CSRF, administrator passphrase and login lockout
protect both preview and final confirmation. The first POST creates a time-limited
random intent for one exact Stripe account/client ID and does not revoke anything.
The second independently confirmed POST atomically consumes the intent, revokes
all matching active access/refresh tokens on that account and writes one audit
entry; other accounts and clients are unaffected. This flow does not register
`stripe_revoke_connection` as an AI-callable write tool. Additional owner account
administration and B-8c money approval remain not built.

### B-8b2b1 emergency LIVE access disable (pending #31)

The private owner setup page creates an expiring ten-minute intent only when
the selected account has `live_enabled=true`. A second, independent owner
passphrase + same-origin + CSRF + checkbox confirmation consumes the intent
and atomically flips only that account to `live_enabled=false`, writing one
audit entry. This never accesses a LIVE key, creates an enable intent or
authorizes any money movement. It is a private owner action, not an MCP tool.

### B-8b2b2 default account for new AI connections (in review)

The private owner setup page stages a ten-minute intent bound to an exact
TEST-connected account and the current default account. Independently
authenticated owner confirmation calls a PostgreSQL function holding a
transaction-scoped advisory lock, compares the stored previous default to
the present value, updates all default flags and audits exactly once.
Existing OAuth token scopes and issued connections are unaffected.
The authorization page reads accounts in default-first order.
No public MCP write is enabled, and no money or LIVE policy is changed.

### B-8b2b3 owner-controlled daily cap (in review)

The owner setup page alone can stage and confirm an account-specific USD
daily-money limit change. It shows verified existing limit, requested limit
and current shared usage as dollar amounts. Requests use exact integer cents,
bound to account and expected previous cap; the database function locks the
same `stripe_accounts` row used by B-1 money reservations and atomically
updates the cap, consumes the intent and audits both amounts. The SQL default
remains 50000 cents ($500). This setting **does not** approve a transfer,
refund or payout: each AI money-out still requires an independently
authenticated owner grant and, above the then-applicable cap, a separate
exact-transaction owner override. B-8c's actual browser approval interface
is still not built. Neither MCP nor HTTPS exposes a money-out or cap-write tool.

### B-8c1 provider-target money requests and private review (PR #34)

Additive columns `target` (default empty for legacy/test fixtures) and
`mode` (default TEST) on `money_approvals`. A money-out's trusted server
preparation must include a stable provider target ID. Reusing a request key
with a changed target, tool, amount, description, currency or mode fails
closed; preexisting empty-target rows cannot be owner-approved. The
separately authenticated owner page exposes a bounded TEST-only pending
list via protected POST, exact account-scoped, escaped account/tool/target/
request/amount/expiry fields, actual Colorado-day shared usage and dollar
limit. No payment or owner approval button exists. This stage DOES NOT
expose real Stripe write handlers or grant owner spending authority.
