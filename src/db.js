import { neon } from '@neondatabase/serverless';
import { hashToken } from './core/oauth.js';

export const CONNECTION_FIELDS = Object.freeze(['stripe_account', 'mode', 'profile', 'listing']);
export const connectionSettings = (row) => Object.fromEntries(CONNECTION_FIELDS.map((field) => [field, row[field]]));

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
    async createOAuthClient({ clientId, clientSecret, redirectUris, clientName }) {
      if (!clientId || !clientSecret || !Array.isArray(redirectUris) || !redirectUris.length) {
        throw new TypeError('Missing OAuth client registration fields');
      }
      const data = JSON.stringify({
        client_secret_hash: hashToken(clientSecret), redirect_uris: redirectUris,
        client_name: clientName || null
      });
      await sql`INSERT INTO oauth_clients (client_id, data) VALUES (${clientId}, ${data}::jsonb)`;
    },
    async getOAuthClient(clientId) {
      const rows = await sql`SELECT client_id, data FROM oauth_clients WHERE client_id = ${clientId}`;
      return rows[0] ? { client_id: rows[0].client_id, ...rows[0].data } : null;
    },
    async createAuthCode({ code, clientId, redirectUri, codeChallenge, codeChallengeMethod = 'S256',
      stripeAccount = null, mode = 'test', profile = 'everyday', listing = 'catalog', ttlSeconds = 600 }) {
      const data = JSON.stringify({
        redirect_uri: redirectUri, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod
      });
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      await sql`INSERT INTO oauth_codes (code, client_id, data, stripe_account, mode, profile, listing, expires_at)
        VALUES (${hashToken(code)}, ${clientId}, ${data}::jsonb, ${stripeAccount},
          ${mode}, ${profile}, ${listing}, ${expiresAt})`;
    },
    async consumeAuthCode(code) {
      if (typeof code !== 'string' || !code) return null;
      const rows = await sql`DELETE FROM oauth_codes WHERE code = ${hashToken(code)}
        AND expires_at > now() RETURNING client_id, data, stripe_account, mode, profile, listing`;
      const row = rows[0];
      return row ? { client_id: row.client_id, ...row.data, ...connectionSettings(row) } : null;
    },
    async createAccessToken({ accessToken, refreshToken, clientId, stripeAccount = null,
      mode = 'test', profile = 'everyday', listing = 'catalog', ttlSeconds = 3600 }) {
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      await sql`INSERT INTO oauth_tokens
        (token_hash, refresh_hash, client_id, stripe_account, mode, profile, listing, expires_at)
        VALUES (${hashToken(accessToken)}, ${refreshToken ? hashToken(refreshToken) : null},
          ${clientId}, ${stripeAccount}, ${mode}, ${profile}, ${listing}, ${expiresAt})`;
    },
    async getAccessToken(accessToken) {
      if (typeof accessToken !== 'string' || !accessToken) return null;
      const rows = await sql`SELECT client_id, stripe_account, mode, profile, listing, kind,
        expires_at, revoked_at FROM oauth_tokens WHERE token_hash = ${hashToken(accessToken)}
        AND expires_at > now() AND revoked_at IS NULL AND kind = 'connector'`;
      return rows[0] || null;
    },
    async getTokenByRefreshToken(refreshToken) {
      if (typeof refreshToken !== 'string' || !refreshToken) return null;
      const rows = await sql`SELECT client_id, stripe_account, mode, profile, listing
        FROM oauth_tokens WHERE refresh_hash = ${hashToken(refreshToken)}
        AND revoked_at IS NULL AND kind = 'connector'`;
      return rows[0] || null;
    },
    async rotateRefreshToken({ refreshToken, clientId, accessToken, newRefreshToken,
      ttlSeconds = 3600 }) {
      // Single atomic update consumes a refresh credential only once, even with concurrent requests.
      // All connection columns remain in this very row: no copying from a default connection.
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
      const rows = await sql`UPDATE oauth_tokens SET
        token_hash = ${hashToken(accessToken)}, refresh_hash = ${hashToken(newRefreshToken)},
        expires_at = ${expiresAt}, last_used_at = NULL
        WHERE refresh_hash = ${hashToken(refreshToken)} AND client_id = ${clientId}
          AND revoked_at IS NULL AND kind = 'connector'
        RETURNING client_id, stripe_account, mode, profile, listing`;
      return rows[0] || null;
    },
    async revokeAccessToken(accessToken) {
      if (typeof accessToken !== 'string' || !accessToken) return false;
      const rows = await sql`UPDATE oauth_tokens SET revoked_at = now()
        WHERE token_hash = ${hashToken(accessToken)} AND revoked_at IS NULL
        RETURNING token_hash`;
      return rows.length > 0;
    },
    async recordLoginAttempt(ip) {
      const rows = await sql`INSERT INTO login_attempts (ip, success) VALUES (${ip}, FALSE) RETURNING id`;
      return rows[0].id;
    },
    async markLoginAttemptSucceeded(id) {
      await sql`UPDATE login_attempts SET success = TRUE WHERE id = ${id}`;
    },
    async countRecentFailedLogins(ip, minutes = 15) {
      const rows = await sql`SELECT count(*)::integer AS count FROM login_attempts
        WHERE ip = ${ip} AND success = FALSE
          AND attempted_at > now() - ${minutes} * interval '1 minute'`;
      return rows[0].count;
    },
    async listStripeAccounts() {
      return await sql`SELECT id, label, live_enabled, is_default
        FROM stripe_accounts ORDER BY is_default DESC, added_at ASC`;
    },
    async getStripeAccount(accountId) {
      const rows = await sql`SELECT id, label, live_enabled FROM stripe_accounts WHERE id = ${accountId}`;
      return rows[0] || null;
    },
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
