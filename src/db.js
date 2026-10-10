import { neon } from '@neondatabase/serverless';
import { hashToken } from './core/oauth.js';

export const CONNECTION_FIELDS = Object.freeze(['stripe_account', 'mode', 'profile', 'listing']);
export const connectionSettings = (row) => Object.fromEntries(CONNECTION_FIELDS.map((field) => [field, row[field]]));

/** All schema changes are additive; never run these against remote infrastructure from tests. */
export const SCHEMA_TABLES = Object.freeze([
  'stripe_accounts', 'oauth_clients', 'oauth_codes', 'oauth_tokens',
  'login_attempts', 'change_log', 'one_time_secrets', 'money_reservations', 'money_approvals'
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
      return await sql`SELECT id, label, live_enabled, is_default,
          test_key_enc IS NOT NULL AS test_connected, live_key_enc IS NOT NULL AS live_connected
        FROM stripe_accounts ORDER BY is_default DESC, added_at ASC`;
    },
    async getStripeAccount(accountId) {
      const rows = await sql`SELECT id, label, live_enabled, is_default, test_key_kind, test_key_last4,
          live_key_kind, live_key_last4, money_limit_cents, key_permissions,
          test_key_enc IS NOT NULL AS test_connected, live_key_enc IS NOT NULL AS live_connected
          FROM stripe_accounts WHERE id = ${accountId}`;
      return rows[0] || null;
    },
    async saveTestKey({ account, label, ciphertext, kind, last4, permissions = {} }) {
      await sql`INSERT INTO stripe_accounts
        (id, label, test_key_enc, test_key_kind, test_key_last4, key_permissions, key_checked_at)
        VALUES (${account}, ${label}, ${ciphertext}, ${kind}, ${last4},
          ${JSON.stringify(permissions)}::jsonb, now())
        ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label,
          test_key_enc = EXCLUDED.test_key_enc, test_key_kind = EXCLUDED.test_key_kind,
          test_key_last4 = EXCLUDED.test_key_last4, key_permissions = EXCLUDED.key_permissions,
          key_checked_at = now()`;
    },
    async getEncryptedKey({ account, mode }) {
      if (mode !== 'test') return null;
      const rows = await sql`SELECT test_key_enc AS ciphertext FROM stripe_accounts
        WHERE id = ${account}`;
      return rows[0] || null;
    },
    async addOneTimeSecret({ id, account, mode, kind, ciphertext, expiresAt }) {
      await sql`INSERT INTO one_time_secrets
        (id, stripe_account, mode, kind, ciphertext, expires_at)
        VALUES (${id}, ${account}, ${mode}, ${kind}, ${ciphertext}, ${expiresAt})`;
    },
    async consumeOneTimeSecret(id) {
      // Atomic delete means two callers cannot both obtain a single-view secret.
      const rows = await sql`DELETE FROM one_time_secrets
        WHERE id = ${id} AND expires_at > now() AND viewed_at IS NULL
        RETURNING stripe_account, mode, kind, ciphertext`;
      return rows[0] || null;
    },
    async requestMoneyApproval({ account, idempotencyKey, tool, description, amountCents, currency }) {
      if (![account,idempotencyKey,tool,description].every(v => typeof v === 'string' && v.length > 0) ||
          description.length > 240 || !Number.isSafeInteger(amountCents) || amountCents <= 0 ||
          currency !== 'usd') throw new TypeError('Valid Stripe-derived money approval request required');
      await sql`INSERT INTO money_approvals
        (stripe_account, request_key, tool, description, amount_cents, currency, expires_at)
        VALUES (${account}, ${idempotencyKey}, ${tool}, ${description}, ${amountCents},
          ${currency}, now() + interval '24 hours')
        ON CONFLICT (stripe_account, request_key) DO NOTHING`;
      const rows = await sql`SELECT tool, amount_cents, currency, description, consumed_at, expires_at
        FROM money_approvals WHERE stripe_account = ${account} AND request_key = ${idempotencyKey}`;
      const row = rows[0];
      return !!row && row.tool === tool && Number(row.amount_cents) === amountCents &&
        row.currency === currency && row.description === description &&
        row.consumed_at === null && new Date(row.expires_at).getTime() > Date.now();
    },
    // SERVER-SIDE ONLY: B-8 owner-authenticated setup page is the sole intended caller.
    // Never register this method as an MCP/HTTPS agent operation.
    async approveMoneyRequest({ account, idempotencyKey, allowOverLimit = false }) {
      if (![account,idempotencyKey].every(v => typeof v === 'string' && v) ||
          allowOverLimit !== false) throw new TypeError('General approval cannot authorize over-limit spending');
      const rows = await sql`UPDATE money_approvals
        SET approved_at = now()
        WHERE stripe_account = ${account} AND request_key = ${idempotencyKey}
          AND consumed_at IS NULL AND expires_at > now()
        RETURNING request_key`;
      return rows.length === 1;
    },
    // Separate owner-authenticated action: can only elevate an already approved
    // exact transaction, never the account's standing $500 budget.
    async approveMoneyOverride({ account, idempotencyKey }) {
      if (![account,idempotencyKey].every(v => typeof v === 'string' && v)) {
        throw new TypeError('Valid owner override required');
      }
      const rows = await sql`UPDATE money_approvals
        SET allow_over_limit = TRUE, override_approved_at = now()
        WHERE stripe_account = ${account} AND request_key = ${idempotencyKey}
          AND approved_at IS NOT NULL AND approved_at > now() - interval '10 minutes'
          AND consumed_at IS NULL AND expires_at > now()
        RETURNING request_key`;
      return rows.length === 1;
    },
    async reserveMoneyOut({ account, connection, idempotencyKey, amountCents, currency }) {
      if (![account, connection, idempotencyKey].every(x => typeof x === 'string' && x) ||
          !Number.isSafeInteger(amountCents) || amountCents <= 0 ||
          typeof currency !== 'string' || !/^[a-z]{3}$/.test(currency)) {
        throw new TypeError('Valid money reservation identity, amount and currency required');
      }
      const rows = await sql`SELECT decision, used_cents, limit_cents FROM
        reserve_money_out_guarded(${account}, ${connection}, ${idempotencyKey},
          ${amountCents}, ${currency})`;
      return rows[0];
    },
    async settleMoneyReservation({ account, connection, idempotencyKey, state }) {
      if (!['confirmed', 'uncertain', 'rejected'].includes(state) ||
          ![account, connection, idempotencyKey].every(x => typeof x === 'string' && x)) {
        throw new TypeError('Only confirmed, rejected or uncertain money reservations can be settled');
      }
      const rows = await sql`UPDATE money_reservations SET state = ${state}
        WHERE stripe_account = ${account} AND connection = ${connection}
          AND request_key = ${idempotencyKey} AND state = 'reserved'
        RETURNING id`;
      return rows.length > 0;
    },
    async getMoneyUsage({ account, connection }) {
      if (![account, connection].every(x => typeof x === 'string' && x)) {
        throw new TypeError('Selected account and connection required');
      }
      const rows = await sql`SELECT
        COALESCE(SUM(r.amount_cents),0)::BIGINT AS used_cents,
        a.money_limit_cents::BIGINT AS limit_cents
        FROM stripe_accounts a LEFT JOIN money_reservations r
          ON r.stripe_account = a.id AND r.local_day = (now() AT TIME ZONE 'America/Denver')::date
            AND r.state <> 'rejected'
        WHERE a.id = ${account} GROUP BY a.money_limit_cents`;
      return rows[0] || null;
    },
    async recordChange({ account = null, mode = 'test', connection = null, tool, target = null, summary,
      before = null, after = null, dryRun = false, amountCents = null, currency = null,
      direction = null, idempotencyKey = null, inverse = null }) {
      if (typeof tool !== 'string' || !tool || typeof summary !== 'string' || !summary) {
        throw new TypeError('Tool and safe summary required for audit record');
      }
      const rows = await sql`INSERT INTO change_log
        (stripe_account, mode, connection, tool, target, summary,
         before, after, dry_run, amount_cents, currency, direction, idempotency_key, inverse)
        VALUES (${account}, ${mode}, ${connection}, ${tool}, ${target}, ${summary},
          ${before === null ? null : JSON.stringify(before)}::jsonb,
          ${after === null ? null : JSON.stringify(after)}::jsonb,
          ${dryRun}, ${amountCents}, ${currency}, ${direction}, ${idempotencyKey},
          ${inverse === null ? null : JSON.stringify(inverse)}::jsonb)
        RETURNING id`;
      return rows[0]?.id;
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
      await sql`CREATE TABLE IF NOT EXISTS money_reservations (
        id BIGSERIAL PRIMARY KEY,
        stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
        connection TEXT NOT NULL,
        request_key TEXT NOT NULL,
        local_day DATE NOT NULL,
        amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
        currency TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'reserved'
          CHECK (state IN ('reserved', 'confirmed', 'uncertain', 'rejected')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (stripe_account, connection, request_key)
      )`;
      // Existing installations have a three-state CHECK. Upgrade once,
      // not by locking and rebuilding the constraint on every request.
      await sql`DO $upgrade$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'money_reservations'::regclass
            AND conname = 'money_reservations_state_check'
            AND pg_get_constraintdef(oid) NOT LIKE '%rejected%'
        ) THEN
          ALTER TABLE money_reservations DROP CONSTRAINT money_reservations_state_check;
          ALTER TABLE money_reservations ADD CONSTRAINT money_reservations_state_check
            CHECK (state IN ('reserved', 'confirmed', 'uncertain', 'rejected'));
        END IF;
      END
      $upgrade$`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS money_reservations_account_key_idx
        ON money_reservations (stripe_account, request_key)`;
      await sql`CREATE INDEX IF NOT EXISTS money_reservations_daily_idx
        ON money_reservations (stripe_account, local_day)`;
      await sql`CREATE TABLE IF NOT EXISTS money_approvals (
        id BIGSERIAL PRIMARY KEY,
        stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
        request_key TEXT NOT NULL,
        tool TEXT NOT NULL,
        description TEXT NOT NULL,
        amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
        currency TEXT NOT NULL CHECK (currency = 'usd'),
        approved_at TIMESTAMPTZ,
        allow_over_limit BOOLEAN NOT NULL DEFAULT FALSE,
        override_approved_at TIMESTAMPTZ,
        consumed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (stripe_account, request_key)
      )`;
      await sql`CREATE INDEX IF NOT EXISTS money_approvals_pending_idx
        ON money_approvals (stripe_account, expires_at) WHERE consumed_at IS NULL`;
      await sql`CREATE OR REPLACE FUNCTION reserve_money_out_guarded(
        p_account TEXT, p_connection TEXT, p_key TEXT, p_cents BIGINT, p_currency TEXT)
      RETURNS TABLE(decision TEXT, used_cents BIGINT, limit_cents BIGINT)
      LANGUAGE plpgsql AS $function$
      DECLARE
        v_day DATE := (now() AT TIME ZONE 'America/Denver')::date;
        v_limit BIGINT;
        v_used BIGINT;
        v_previous RECORD;
        v_duplicate BOOLEAN;
        v_approval RECORD;
      BEGIN
        IF p_account IS NULL OR p_account = '' OR p_connection IS NULL OR p_connection = ''
          OR p_key IS NULL OR p_key = '' OR p_cents IS NULL OR p_cents <= 0
          OR p_currency !~ '^[a-z]{3}$' THEN
          RAISE EXCEPTION 'Invalid money reservation';
        END IF;
        -- Serialize requests by locking the common account row. After the lock,
        -- a separate SQL statement sees the prior reservation's committed row.
        -- The owner's cap is denominated in USD cents. No mixing unrelated
        -- currencies or zero-decimal units before a verified conversion policy.
        IF p_currency <> 'usd' THEN
          decision := 'currency_unsupported'; used_cents := 0; limit_cents := 0;
          RETURN NEXT; RETURN;
        END IF;
        SELECT money_limit_cents::BIGINT INTO v_limit
        FROM stripe_accounts WHERE id = p_account FOR UPDATE;
        IF NOT FOUND THEN
          decision := 'account_missing'; used_cents := 0; limit_cents := 0;
          RETURN NEXT; RETURN;
        END IF;
        SELECT amount_cents, currency, state, local_day INTO v_previous
          FROM money_reservations
          WHERE stripe_account = p_account AND request_key = p_key;
        v_duplicate := FOUND;
        SELECT COALESCE(SUM(amount_cents), 0)::BIGINT INTO v_used
          FROM money_reservations
          WHERE stripe_account = p_account AND local_day = v_day
            AND state <> 'rejected';
        used_cents := v_used;
        limit_cents := GREATEST(v_limit, 0);
        IF v_duplicate THEN
          IF v_previous.amount_cents <> p_cents OR v_previous.currency <> p_currency THEN
            decision := 'request_conflict';
          ELSIF v_previous.local_day <> v_day THEN
            decision := 'previous_day';
          ELSE
            decision := 'already_' || v_previous.state;
          END IF;
          RETURN NEXT; RETURN;
        END IF;
        -- The approval is tied to this account, idempotency key and the exact
        -- provider-derived amount, then consumed atomically with the reservation.
        SELECT amount_cents, currency, approved_at, allow_over_limit, override_approved_at, consumed_at, expires_at
          INTO v_approval FROM money_approvals
          WHERE stripe_account = p_account AND request_key = p_key FOR UPDATE;
        IF NOT FOUND OR v_approval.amount_cents <> p_cents OR v_approval.currency <> p_currency
          OR v_approval.approved_at IS NULL OR v_approval.consumed_at IS NOT NULL
          OR v_approval.expires_at <= now()
          OR v_approval.approved_at < now() - interval '10 minutes' THEN
          decision := 'owner_approval_required';
          RETURN NEXT; RETURN;
        END IF;
        IF v_used > limit_cents - p_cents AND (v_approval.allow_over_limit IS NOT TRUE
          OR v_approval.override_approved_at IS NULL) THEN
          decision := 'limit_exceeded_override_required';
          RETURN NEXT; RETURN;
        END IF;
        UPDATE money_approvals SET consumed_at = now()
          WHERE stripe_account = p_account AND request_key = p_key;
        INSERT INTO money_reservations
          (stripe_account, connection, request_key, local_day, amount_cents, currency)
        VALUES (p_account, p_connection, p_key, v_day, p_cents, p_currency);
        used_cents := v_used + p_cents;
        decision := 'reserved';
        RETURN NEXT;
      END;
      $function$`;
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
