import { neon } from '@neondatabase/serverless';
import { hashToken } from './core/oauth.js';

export const CONNECTION_FIELDS = Object.freeze(['stripe_account', 'mode', 'profile', 'listing']);
export const connectionSettings = (row) => Object.fromEntries(CONNECTION_FIELDS.map((field) => [field, row[field]]));

/** All schema changes are additive; never run these against remote infrastructure from tests. */
export const SCHEMA_TABLES = Object.freeze([
  'stripe_accounts', 'oauth_clients', 'oauth_codes', 'oauth_tokens',
  'login_attempts', 'change_log', 'one_time_secrets', 'money_reservations', 'money_approvals', 'live_enable_intents', 'owner_revoke_intents', 'owner_disable_live_intents', 'owner_default_account_intents', 'owner_money_limit_intents'
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
    async updateKeyPermissions({account,permissions,expectedCiphertext}) {
      if (typeof expectedCiphertext!=='string' || !expectedCiphertext ||
          typeof account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(account) ||
          !permissions || typeof permissions!=='object' || Array.isArray(permissions) ||
          !Object.values(permissions).every(v=>v==='ok'||v==='denied')) {
        throw new TypeError('Verified permission result and account required');
      }
      const rows=await sql`UPDATE stripe_accounts SET
        key_permissions=${JSON.stringify(permissions)}::jsonb, key_checked_at=now()
        WHERE id=${account} AND test_key_enc = ${expectedCiphertext} RETURNING id`;
      return rows.length===1;
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
    async createLiveEnableIntent({ id, account, expiresAt }) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id) ||
          typeof account !== 'string' || !account || !(expiresAt instanceof Date) ||
          !Number.isFinite(expiresAt.getTime())) {
        throw new TypeError('Valid one-time live intent required');
      }
      const rows = await sql`INSERT INTO live_enable_intents
        (id, stripe_account, expires_at) VALUES (${id}, ${account}, ${expiresAt})
        RETURNING id`;
      return rows.length === 1;
    },
    async getLiveEnableIntent(id) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id)) return null;
      const rows = await sql`SELECT i.id, i.stripe_account, a.label, i.expires_at
        FROM live_enable_intents i JOIN stripe_accounts a ON a.id = i.stripe_account
        WHERE i.id = ${id} AND i.consumed_at IS NULL AND i.expires_at > now()`;
      return rows[0] || null;
    },
    // Only the origin/CSRF/password-protected owner setup POST may call this.
    // The caller must also set the explicit owner-controlled IN-06 environment gate.
    async consumeLiveEnableIntent({ id, allowActivation = false }) {
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id) ||
          allowActivation !== true) return false;
      // Intention, live-key check, state flip and audit are one statement. An audit
      // failure rolls back activation instead of creating an unaudited live mode.
      const rows = await sql`WITH consumed AS (
        UPDATE live_enable_intents SET consumed_at = now()
          WHERE id = ${id} AND consumed_at IS NULL AND expires_at > now()
          RETURNING stripe_account
        ), activated AS (
        UPDATE stripe_accounts SET live_enabled = TRUE
          WHERE id = (SELECT stripe_account FROM consumed) AND live_key_enc IS NOT NULL
          RETURNING id
        )
        INSERT INTO change_log (stripe_account, mode, tool, summary, dry_run)
          SELECT id, 'live', 'stripe_enable_live',
            'Owner independently approved LIVE mode for this account', FALSE
          FROM activated RETURNING id`;
      return rows.length === 1;
    },
    async requestMoneyLimitIntent({id,account,newLimitCents,expiresAt}) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id) ||
          typeof account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(account) ||
          !Number.isSafeInteger(newLimitCents) || newLimitCents<0 ||
          newLimitCents>2147483647 ||
          !(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime())) {
        throw new TypeError('Safe USD money-limit and owner intent required');
      }
      const rows=await sql`INSERT INTO owner_money_limit_intents
        (id,stripe_account,expected_limit_cents,new_limit_cents,expires_at)
        SELECT ${id},a.id,a.money_limit_cents,${newLimitCents},${expiresAt}
        FROM stripe_accounts a WHERE a.id=${account}
          AND a.test_key_enc IS NOT NULL AND a.money_limit_cents!=${newLimitCents}
        RETURNING id`;
      return rows.length===1;
    },
    async getMoneyLimitIntent(id) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id)) return null;
      const rows=await sql`SELECT i.id,i.stripe_account,a.label,
          i.expected_limit_cents,i.new_limit_cents,i.expires_at
        FROM owner_money_limit_intents i JOIN stripe_accounts a
          ON a.id=i.stripe_account
        WHERE i.id=${id} AND i.consumed_at IS NULL AND i.expires_at>now()`;
      return rows[0] || null;
    },
    async consumeMoneyLimitIntent(id) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id)) return false;
      const rows=await sql`SELECT apply_owner_money_limit_intent(${id}) AS applied`;
      return rows[0]?.applied===true;
    },
    async requestDefaultAccountIntent({id,account,expiresAt}) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id) ||
          typeof account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(account) ||
          !(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime())) {
        throw new TypeError('Valid owner default-account intent required');
      }
      const rows=await sql`INSERT INTO owner_default_account_intents
        (id,stripe_account,expected_default,expires_at)
        SELECT ${id},a.id,
          (SELECT id FROM stripe_accounts WHERE is_default=TRUE ORDER BY id LIMIT 1),
          ${expiresAt}
        FROM stripe_accounts a
        WHERE a.id=${account} AND a.test_key_enc IS NOT NULL
          AND a.is_default=FALSE
        RETURNING id`;
      return rows.length===1;
    },
    async getDefaultAccountIntent(id) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id)) return null;
      const rows=await sql`SELECT i.id,i.stripe_account,i.expected_default,
        i.expires_at,a.label FROM owner_default_account_intents i
        JOIN stripe_accounts a ON a.id=i.stripe_account
        WHERE i.id=${id} AND i.consumed_at IS NULL AND i.expires_at>now()`;
      return rows[0] || null;
    },
    async consumeDefaultAccountIntent(id) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id)) return false;
      const rows=await sql`SELECT apply_owner_default_account_intent(${id}) AS applied`;
      return rows[0]?.applied===true;
    },
    async requestDisableLiveIntent({id,account,expiresAt}) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id) ||
          typeof account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(account) ||
          !(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime())) {
        throw new TypeError('Valid LIVE-disable intent required');
      }
      const rows=await sql`INSERT INTO owner_disable_live_intents
        (id,stripe_account,expires_at)
        SELECT ${id},${account},${expiresAt}
        WHERE EXISTS (SELECT 1 FROM stripe_accounts a
          WHERE a.id=${account} AND a.live_enabled=TRUE)
        RETURNING id`;
      return rows.length===1;
    },
    async getDisableLiveIntent(id) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id)) return null;
      const rows=await sql`SELECT i.id,i.stripe_account,a.label,i.expires_at
        FROM owner_disable_live_intents i
        JOIN stripe_accounts a ON a.id=i.stripe_account
        WHERE i.id=${id} AND i.consumed_at IS NULL
          AND i.expires_at>now() AND a.live_enabled=TRUE`;
      return rows[0] || null;
    },
    // Emergency DENY only: no live key is decrypted, enrolled, or accepted.
    // Account state, single-use intent and one audit row share one statement.
    async consumeDisableLiveIntent(id) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id)) return false;
      const rows=await sql`WITH disabled AS (
        UPDATE stripe_accounts a SET live_enabled=FALSE
        WHERE a.live_enabled=TRUE AND a.id=(
          SELECT i.stripe_account FROM owner_disable_live_intents i
          WHERE i.id=${id} AND i.consumed_at IS NULL AND i.expires_at>now()
        ) RETURNING a.id
      ), consumed AS (
        UPDATE owner_disable_live_intents i SET consumed_at=now()
        FROM disabled d WHERE i.id=${id} AND i.stripe_account=d.id
          AND i.consumed_at IS NULL AND i.expires_at>now()
        RETURNING i.stripe_account
      )
      INSERT INTO change_log (stripe_account,mode,tool,target,summary,dry_run)
      SELECT stripe_account,'live','stripe_disable_live',stripe_account,
        'Owner disabled LIVE connection access using the private setup page',FALSE
      FROM consumed RETURNING id`;
      return rows.length===1;
    },
    async requestConnectionRevokeIntent({id,account,clientId,expiresAt}) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id) ||
          typeof account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(account) ||
          typeof clientId!=='string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(clientId) ||
          !(expiresAt instanceof Date) || !Number.isFinite(expiresAt.getTime())) {
        throw new TypeError('Valid account, connection and one-time intent required');
      }
      const rows=await sql`INSERT INTO owner_revoke_intents (id,stripe_account,client_id,expires_at)
        SELECT ${id},${account},${clientId},${expiresAt}
        WHERE EXISTS (SELECT 1 FROM oauth_tokens t WHERE t.stripe_account=${account}
          AND t.client_id=${clientId} AND t.kind='connector' AND t.revoked_at IS NULL)
        RETURNING id`;
      return rows.length===1;
    },
    async getConnectionRevokeIntent(id) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id)) return null;
      const rows=await sql`SELECT i.id,i.stripe_account,i.client_id,a.label,i.expires_at
        FROM owner_revoke_intents i
        JOIN stripe_accounts a ON a.id=i.stripe_account
        WHERE i.id=${id} AND i.consumed_at IS NULL AND i.expires_at>now()`;
      return rows[0] || null;
    },
    // Only the separately password-authenticated owner page may invoke this
    // method. State change, one-time intent consumption and audit are one SQL
    // statement, including when multiple serverless instances race.
    async consumeConnectionRevokeIntent(id) {
      if (typeof id!=='string' || !/^[A-Za-z0-9_-]{32,64}$/.test(id)) return false;
      const rows=await sql`WITH consumed AS (
        UPDATE owner_revoke_intents i SET consumed_at=now()
        WHERE i.id=${id} AND i.consumed_at IS NULL AND i.expires_at>now()
          AND EXISTS (SELECT 1 FROM oauth_tokens t WHERE
            t.stripe_account=i.stripe_account AND t.client_id=i.client_id
            AND t.kind='connector' AND t.revoked_at IS NULL)
        RETURNING i.stripe_account,i.client_id
      ), revoked AS (
        UPDATE oauth_tokens t SET revoked_at=now()
        FROM consumed i WHERE t.stripe_account=i.stripe_account
          AND t.client_id=i.client_id AND t.kind='connector' AND t.revoked_at IS NULL
        RETURNING t.stripe_account,t.client_id
      )
      INSERT INTO change_log (stripe_account,mode,tool,target,summary,dry_run)
      SELECT stripe_account,'test','stripe_revoke_connection',client_id,
        'Owner revoked this account connection from the private setup page',FALSE
      FROM revoked LIMIT 1 RETURNING id`;
      return rows.length===1;
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
    async listRecentChanges({ account, mode = null, limit = 20, offset = 0 }) {
      if (typeof account !== 'string' || !account ||
          (mode !== null && !['test','live'].includes(mode)) ||
          !Number.isInteger(limit) || limit < 1 || limit > 100 ||
          !Number.isInteger(offset) || offset < 0 || offset > 1000000) {
        throw new TypeError('Account, mode and bounded limit/offset required');
      }
      return await sql`SELECT id, at, stripe_account, mode, connection, tool,
          target, summary, dry_run, amount_cents, currency, direction
        FROM change_log
        WHERE stripe_account = ${account} AND (${mode}::text IS NULL OR mode = ${mode})
        ORDER BY at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`;
    },
    async listConnectionsForAccount({ account, limit = 50, offset = 0 }) {
      if (typeof account !== 'string' || !account ||
          !Number.isInteger(limit) || limit < 1 || limit > 100 ||
          !Number.isInteger(offset) || offset < 0 || offset > 1000000) {
        throw new TypeError('Selected account and bounded limit/offset required');
      }
      // Never select bearer hashes, refresh hashes, client secrets or codes.
      return await sql`SELECT client_id, mode, profile, listing, created_at,
          last_used_at, expires_at, revoked_at
        FROM oauth_tokens WHERE stripe_account = ${account} AND kind = 'connector'
        ORDER BY created_at DESC, token_hash DESC LIMIT ${limit} OFFSET ${offset}`;
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
      await sql`CREATE TABLE IF NOT EXISTS owner_money_limit_intents (
        id TEXT PRIMARY KEY,
        stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
        expected_limit_cents INTEGER NOT NULL,
        new_limit_cents INTEGER NOT NULL
          CHECK (new_limit_cents >= 0),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS owner_money_limit_intents_expiry_idx
        ON owner_money_limit_intents (expires_at)`;
      await sql`CREATE OR REPLACE FUNCTION apply_owner_money_limit_intent(p_id TEXT)
      RETURNS BOOLEAN LANGUAGE plpgsql AS $fn$
      DECLARE
        v_intent RECORD;
        v_current INTEGER;
      BEGIN
        SELECT i.id,i.stripe_account,i.expected_limit_cents,i.new_limit_cents
          INTO v_intent FROM owner_money_limit_intents i
          WHERE i.id=p_id AND i.consumed_at IS NULL AND i.expires_at>now()
          FOR UPDATE;
        IF NOT FOUND THEN RETURN FALSE; END IF;
        -- Same account-row lock B-1 reservations use: new cap cannot race spend.
        SELECT money_limit_cents INTO v_current FROM stripe_accounts
          WHERE id=v_intent.stripe_account AND test_key_enc IS NOT NULL
          FOR UPDATE;
        IF NOT FOUND OR v_current IS DISTINCT FROM v_intent.expected_limit_cents
          OR v_intent.new_limit_cents < 0 THEN RETURN FALSE; END IF;
        UPDATE stripe_accounts SET money_limit_cents=v_intent.new_limit_cents
          WHERE id=v_intent.stripe_account;
        UPDATE owner_money_limit_intents SET consumed_at=now()
          WHERE id=v_intent.id;
        INSERT INTO change_log
          (stripe_account,mode,tool,target,summary,dry_run,before,after)
          VALUES (v_intent.stripe_account,'test','stripe_set_money_limit',
            v_intent.stripe_account,
            'Owner changed the daily USD money-out account limit from the private setup page',
            FALSE,jsonb_build_object('limit_cents',v_current),
            jsonb_build_object('limit_cents',v_intent.new_limit_cents));
        RETURN TRUE;
      END;
      $fn$`;
      await sql`CREATE TABLE IF NOT EXISTS owner_default_account_intents (
        id TEXT PRIMARY KEY,
        stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
        expected_default TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS owner_default_account_intents_expiry_idx
        ON owner_default_account_intents (expires_at)`;
      await sql`CREATE OR REPLACE FUNCTION apply_owner_default_account_intent(p_id TEXT)
      RETURNS BOOLEAN LANGUAGE plpgsql AS $fn$
      DECLARE
        v_intent RECORD;
        v_current TEXT;
      BEGIN
        -- A single transaction-scoped lock serializes changes across instances.
        PERFORM pg_advisory_xact_lock(27491,18032);
        SELECT i.id,i.stripe_account,i.expected_default
          INTO v_intent FROM owner_default_account_intents i
          WHERE i.id=p_id AND i.consumed_at IS NULL AND i.expires_at>now()
          FOR UPDATE;
        IF NOT FOUND THEN RETURN FALSE; END IF;
        SELECT id INTO v_current FROM stripe_accounts
          WHERE is_default=TRUE ORDER BY id LIMIT 1;
        IF v_current IS DISTINCT FROM v_intent.expected_default THEN
          RETURN FALSE;
        END IF;
        PERFORM 1 FROM stripe_accounts
          WHERE id=v_intent.stripe_account AND test_key_enc IS NOT NULL;
        IF NOT FOUND THEN RETURN FALSE; END IF;
        UPDATE stripe_accounts SET is_default=FALSE WHERE is_default=TRUE;
        UPDATE stripe_accounts SET is_default=TRUE
          WHERE id=v_intent.stripe_account;
        UPDATE owner_default_account_intents SET consumed_at=now()
          WHERE id=v_intent.id;
        INSERT INTO change_log (stripe_account,mode,tool,target,summary,dry_run)
          VALUES (v_intent.stripe_account,'test','stripe_set_default_account',
            v_intent.stripe_account,
            'Owner selected this account as default on the private setup page',FALSE);
        RETURN TRUE;
      END;
      $fn$`;
      await sql`CREATE TABLE IF NOT EXISTS owner_disable_live_intents (
        id TEXT PRIMARY KEY,
        stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS owner_disable_live_intents_expiry_idx
        ON owner_disable_live_intents (expires_at)`;
      await sql`CREATE TABLE IF NOT EXISTS owner_revoke_intents (
        id TEXT PRIMARY KEY,
        stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
        client_id TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS owner_revoke_intents_expiry_idx
        ON owner_revoke_intents (expires_at)`;
      await sql`CREATE TABLE IF NOT EXISTS live_enable_intents (
        id TEXT PRIMARY KEY,
        stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ
      )`;
      await sql`CREATE INDEX IF NOT EXISTS live_enable_intents_expiry_idx
        ON live_enable_intents (expires_at)`;
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
