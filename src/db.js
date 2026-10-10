import { neon } from '@neondatabase/serverless';

/** All schema changes are additive; never run these against remote infrastructure from tests. */
export const SCHEMA_TABLES = Object.freeze([
  'stripe_accounts', 'oauth_clients', 'oauth_codes', 'oauth_tokens',
  'login_attempts', 'change_log', 'one_time_secrets'
]);

let productionSql;
function getProductionSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured. Set it in the server environment.');
  if (!productionSql) productionSql = neon(process.env.DATABASE_URL);
  return productionSql;
}

/**
 * Inject a tagged-template query function for tests. No connection or migration
 * runs at import time. In production the caller uses the configured Neon client.
 */
export function createDb(sql = getProductionSql()) {
  if (typeof sql !== 'function') throw new TypeError('A SQL tagged-template function is required');
  return {
    async initSchema() {
      await sql`CREATE TABLE IF NOT EXISTS stripe_accounts (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        business_name TEXT,
        test_key_enc TEXT,
        live_key_enc TEXT,
        test_key_kind TEXT,
        live_key_kind TEXT,
        test_key_last4 TEXT,
        live_key_last4 TEXT,
        key_permissions JSONB,
        live_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        money_limit_cents INTEGER NOT NULL DEFAULT 50000,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        key_checked_at TIMESTAMPTZ
      )`;
      await sql`CREATE TABLE IF NOT EXISTS oauth_clients (
        client_id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS oauth_codes (
        code TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        data JSONB NOT NULL,
        stripe_account TEXT,
        mode TEXT NOT NULL DEFAULT 'test',
        profile TEXT NOT NULL DEFAULT 'everyday',
        listing TEXT NOT NULL DEFAULT 'catalog',
        expires_at TIMESTAMPTZ NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS oauth_tokens (
        token_hash TEXT PRIMARY KEY,
        client_id TEXT,
        refresh_hash TEXT,
        stripe_account TEXT,
        mode TEXT NOT NULL DEFAULT 'test',
        profile TEXT NOT NULL DEFAULT 'everyday',
        listing TEXT NOT NULL DEFAULT 'catalog',
        kind TEXT NOT NULL DEFAULT 'connector',
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS login_attempts (
        id BIGSERIAL PRIMARY KEY,
        ip TEXT NOT NULL,
        attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        success BOOLEAN NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS change_log (
        id BIGSERIAL PRIMARY KEY,
        at TIMESTAMPTZ NOT NULL DEFAULT now(),
        stripe_account TEXT,
        mode TEXT,
        connection TEXT,
        tool TEXT NOT NULL,
        target TEXT,
        summary TEXT NOT NULL,
        before JSONB,
        after JSONB,
        dry_run BOOLEAN NOT NULL DEFAULT FALSE,
        amount_cents BIGINT,
        currency TEXT,
        direction TEXT,
        idempotency_key TEXT,
        inverse JSONB,
        undone_by BIGINT
      )`;
      await sql`CREATE TABLE IF NOT EXISTS one_time_secrets (
        id TEXT PRIMARY KEY,
        stripe_account TEXT,
        mode TEXT,
        kind TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        viewed_at TIMESTAMPTZ
      )`;
      await sql`CREATE INDEX IF NOT EXISTS oauth_codes_expiration_idx ON oauth_codes (expires_at)`;
      await sql`CREATE INDEX IF NOT EXISTS oauth_tokens_refresh_idx ON oauth_tokens (refresh_hash)`;
      await sql`CREATE INDEX IF NOT EXISTS oauth_tokens_expiration_idx ON oauth_tokens (expires_at)`;
      await sql`CREATE INDEX IF NOT EXISTS login_attempts_window_idx ON login_attempts (ip, attempted_at)`;
      await sql`CREATE INDEX IF NOT EXISTS change_log_account_time_idx ON change_log (stripe_account, at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS one_time_secrets_expiration_idx ON one_time_secrets (expires_at)`;
    }
  };
}

export async function initSchema() {
  return createDb().initSchema();
}
