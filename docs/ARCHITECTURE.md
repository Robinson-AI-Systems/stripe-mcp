# ARCHITECTURE — runtime facts, as built

This file describes what **exists**, and is updated in the same PR that ships it (DRIFT-PROTOCOL checklist B). What the
system is designed to become is in `docs/designs/`; do not copy design text here before it is built.

As of 2026-10-10: A-1 test/CI foundation and A-2 additive database schema code are built. No deployed server, remote database, operational Stripe key store or Stripe tool exists.

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

Six additive indexes support code/token expiry, login lockout, changes and secret expiry. A-3 adds login operations; A-5 adds encryption and key handling. Later batches extend schema through their own migrations.

## Endpoints

None yet.

## Stripe API version

Not pinned yet (A-4). Record the version and the vendored OpenAPI tag here when A-4 ships.
