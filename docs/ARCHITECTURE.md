# ARCHITECTURE — runtime facts, as built

This file describes what **exists**, and is updated in the same PR that ships it (DRIFT-PROTOCOL checklist B). What the
system is designed to become is in `docs/designs/`; do not copy design text here before it is built.

As of 2026-10-10: foundation A-1 through A-3 and A-4a pinned SDK client are built. No deployed server, remote database, operational Stripe key store or Stripe tool exists.

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

A-2 defines seven tables, created **only when `initSchema()` is invoked**. In CI, creation is confined to an isolated throwaway localhost PostgreSQL schema. No real Neon database has been created or migrated.

| Table | Purpose |
|---|---|
| `stripe_accounts` | Per-account labels, encrypted key slots, live-mode gate and money limit |
| `oauth_clients` | Client registrations |
| `oauth_codes` | Expiring one-time login codes and connection scope |
| `oauth_tokens` | Hashed access/refresh credentials and exact account/mode/profile/listing |
| `login_attempts` | Auditable sign-in attempts and future lockout |
| `change_log` | Preview/confirm/read-back audit history and future undo links |
| `one_time_secrets` | Only ciphertext, expiry and single-view record |

Six additive indexes support code/token expiry, login lockout, changes and secret expiry. A-3a added hashed client registration, authorization code consumption, access/refresh rotation, revocation, login lockout and account selection methods. A-3b adds HTTP OAuth endpoints and the connector door; A-5 adds encryption and key handling. Later batches extend schema through their own migrations.

## Endpoints

A-3b provides `/api/oauth/register`, `/api/oauth/authorize`, `/api/oauth/token`, `/.well-known/oauth-authorization-server`, `/.well-known/oauth-protected-resource`, `/api/mcp`, `/api` (status). OAuth access credentials expire after one hour; hashed refresh credentials persist until revocation and rotate on use. The MCP bearer token is not used with Stripe.

## Stripe API version

`src/stripe/client.js` pins the official Stripe Node SDK (package lock: v23.0.0) to `2026-09-30.endive`. Keys are passed only from the encrypted store (planned A-5) and never held in this repo. Non-production deployments refuse live keys; test-only transport override cannot be selected by a production request. The exact published Stripe v2556 SDK OpenAPI description is vendored in 23 byte-preserving parts under `vendor/stripe-openapi/` due the GitHub write-size limit. `scripts/stripe-openapi.mjs` checks the reconstructed Git blob SHA-1 `509de1b4510d2c03ad8755d06778c1deb5619c7f`, version and path count before using it. `scripts/openapi-find.mjs` provides capped, read-only lookups and prints the SHA-256 on `--verify`; SOURCE.md preserves provenance.
