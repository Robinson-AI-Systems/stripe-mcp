# ARCHITECTURE — runtime facts, as built

This file describes what **exists**, and is updated in the same PR that ships it (DRIFT-PROTOCOL checklist B). What the
system is designed to become is in `docs/designs/`; do not copy design text here before it is built.

As of 2026-10-10: foundation A-1 through A-4 and A-5a server-only encrypted key and one-time-secret storage primitives are built. No deployed server, remote database, operational Stripe key store or Stripe tool exists.

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

A-2 defined seven tables; B-1b1 adds an eighth, `money_reservations`. All eight tables, created **only when `initSchema()` is invoked**. In CI, creation is confined to an isolated throwaway localhost PostgreSQL schema. No real Neon database has been created or migrated.

| Table | Purpose |
|---|---|
| `stripe_accounts` | Per-account labels, encrypted key slots, live-mode gate and money limit |
| `oauth_clients` | Client registrations |
| `oauth_codes` | Expiring one-time login codes and connection scope |
| `oauth_tokens` | Hashed access/refresh credentials and exact account/mode/profile/listing |
| `login_attempts` | Auditable sign-in attempts and future lockout |
| `change_log` | Preview/confirm/read-back audit history and future undo links |
| `one_time_secrets` | Only ciphertext, expiry and single-view record |
| `money_reservations` | Durable per-connection money-out reservation, UTC timestamp, Denver day, idempotency and conservative spend status (B-1b1) |

Six additive indexes support code/token expiry, login lockout, changes and secret expiry. A-5a adds `src/core/crypto.js` AES-256-GCM authenticated encryption (random nonce, additional authenticated context and no plaintext fallback); `src/keys.js` stores and retrieves test-only Stripe keys server-side in encrypted form, and `src/core/one-time-secrets.js` uses atomic database deletion on reveal. A-5b adds the private owner-only `/api/stripe/setup` endpoint with strict origin/CSRF checks, passphrase lockout, account-verification and permission probes; no real owner key has been entered. Read-only `stripe_whoami` and `stripe_list_accounts` are dispatched through the MCP bearer guard. Writes remain denied until Batch B. `TOKEN_ENCRYPTION_KEY` is required only when these functions execute; it is not configured in any deployment. A-3a added hashed client registration, authorization code consumption, access/refresh rotation, revocation, login lockout and account selection methods. A-3b adds HTTP OAuth endpoints and the connector door; A-5 adds encryption and key handling. Later batches extend schema through their own migrations.

## Endpoints

`/api/stripe/setup` is a dedicated owner-only browser form; raw Stripe keys never enter MCP or tool calls. GET issues a secure 10-minute CSRF cookie; POST requires matching origin, cookie, form token and admin passphrase. One-time secrets appear only after authenticated POST, with an atomic delete. No live credentials are accepted.

A-3b provides `/api/oauth/register`, `/api/oauth/authorize`, `/api/oauth/token`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/api/mcp`, `/api` (status). OAuth access credentials expire after one hour; hashed refresh credentials persist until revocation and rotate on use. The MCP bearer token is not used with Stripe.

## Safety (Batch B in progress)

B-1b2 (PR #20) wires the generic `defineWrite` lifecycle to trusted monetary descriptions, integer USD cents, the atomic daily reservation ledger, confirmation, independent read-back and conservative settlement. Its seven-case contract tests use fake provider records and accept each real write tool's handler/fixtures directly. Confirmed Stripe invalid requests, access denials and card declines release rejected money reservations without replay; unknown/network outcomes retain reserved capacity. The schema's state constraint upgrades once, without dropping records. A missing `moneyPolicyApproved` server-side context is a hard deny for money out; no public MCP write tools are registered. Actual live/app-ownership guards and real Stripe operations still require B-2/B-3 and later batches.


B-1b1 adds `money_reservations`, an account-row-locked PostgreSQL function `reserve_money_out_guarded`, and the server-only `reserveMoneyOut`, `getMoneyUsage`, `settleMoneyReservation` database methods. Same request key is never reserved twice, concurrent requests cannot jointly overspend their connection limit, and uncertain outcomes never silently return capacity. The accounting cap is USD cents and non-USD attempts return `currency_unsupported` (conservative protection until a verified conversion policy exists). Test fixtures use the existing unapproved $500 schema default, but **no money write tool is enabled**. B-1b2 owns the actual money spec, daily enforcement integration and IN-05 decision.


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
The owner-authenticated approval interface belongs to B-8 and remains unavailable
until independently tested; therefore no real money movement is enabled.

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
