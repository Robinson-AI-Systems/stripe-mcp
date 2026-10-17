import { neon } from '@neondatabase/serverless';
import {createWebhookCreationStore,initWebhookCreationTables} from './webhooks/create-store.js';
import {createWebhookSignatureDb,initWebhookSignatureTables} from './webhooks/signature-store.js';
import {createTestWebhookReceiptStore,initTestWebhookReceiptTables} from './webhooks/receipt-store.js';
import { hashToken } from './core/oauth.js';
import {createBrandKitStore,initBrandKitTables} from './brand/store.js';
import {createAppProfileStore,initAppProfileTables} from './apps/profiles.js';
import {createDevRunStore,initDevRunTables} from './dev/run-store.js';
import {createDevForwarderStore,initDevForwarderTables}
  from './dev/forwarder-store.js';
import {createDevForwarderReplayStore,initDevForwarderReplayTables}
  from './dev/forwarder-replay-store.js';
import {createDevSimulationCycleStore,initDevSimulationCycleTables}
  from './dev/simulation-cycle-store.js';

export const CONNECTION_FIELDS = Object.freeze(['stripe_account', 'mode', 'profile', 'listing']);
export const connectionSettings = (row) => Object.fromEntries(CONNECTION_FIELDS.map((field) => [field, row[field]]));

/** All schema changes are additive; never run these against remote infrastructure from tests. */
export const SCHEMA_TABLES = Object.freeze([
  'stripe_accounts', 'oauth_clients', 'oauth_codes', 'oauth_tokens',
  'login_attempts', 'change_log', 'one_time_secrets', 'money_reservations', 'money_approvals', 'live_enable_intents', 'owner_revoke_intents', 'owner_disable_live_intents', 'owner_default_account_intents', 'owner_money_limit_intents', 'owner_money_decision_intents', 'result_store', 'dev_runs', 'dev_run_objects', 'dev_forwarders', 'dev_forwarder_replays', 'dev_forwarder_replay_events', 'dev_simulation_cycles', 'webhook_create_intents', 'webhook_signing_secrets', 'test_webhook_receipts', 'rtc_pass_rates', 'brand_kits', 'known_apps', 'app_profile_account_scope', 'project_setup_runs'
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
    ...createWebhookCreationStore(sql),
    ...createWebhookSignatureDb(sql),
    ...createTestWebhookReceiptStore(sql),
    ...createDevRunStore(sql),
    ...createBrandKitStore(sql),
    ...createAppProfileStore(sql),
    ...createDevForwarderStore(sql),
    ...createDevForwarderReplayStore(sql),
    ...createDevSimulationCycleStore(sql),
    async createOAuthClient({ clientId, clientSecret, tokenEndpointAuthMethod = 'client_secret_post',
      redirectUris, clientName }) {
      if (!clientId || !['client_secret_post','client_secret_basic','none'].includes(tokenEndpointAuthMethod) ||
        (tokenEndpointAuthMethod === 'none' ? clientSecret != null : !clientSecret) ||
        !Array.isArray(redirectUris) || !redirectUris.length) {
        throw new TypeError('Missing or invalid OAuth client registration fields');
      }
      const data = JSON.stringify({
        token_endpoint_auth_method: tokenEndpointAuthMethod,
        client_secret_hash: clientSecret ? hashToken(clientSecret) : null,
        redirect_uris: redirectUris, client_name: clientName || null
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
    async createRtcReadOnlyPass({id,account,token,expiresAt,areas=null}) {
      if(areas!==null&&(!Array.isArray(areas)||areas.length<1||areas.length>6||
        areas.some(a=>typeof a!=='string'||!/^[a-z][a-z_]{0,49}$/.test(a))||
        new Set(areas).size!==areas.length))
        throw new TypeError('Valid read-only area selection required');
      const areaList=areas?.join(',')??null;
      if(typeof id!=='string'||!/^rtc-agent-[a-z0-9-]{8,80}$/.test(id)||
        typeof account!=='string'||!/^acct_[A-Za-z0-9]{2,100}$/.test(account)||
        typeof token!=='string'||!/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(token)||
        !(expiresAt instanceof Date)||!Number.isFinite(expiresAt.getTime())||
        expiresAt.getTime()<=Date.now()||expiresAt.getTime()>Date.now()+86460000)
        throw new TypeError('Safe short-lived RTC TEST pass required');
      const rows=await sql`INSERT INTO oauth_tokens
        (token_hash,client_id,stripe_account,mode,profile,listing,kind,
         allow_writes,money_limit_cents,areas,for_hub,rate_limit_per_minute,expires_at)
        SELECT ${hashToken(token)},${id},id,'test','read_only','compact','pass',
          FALSE,0,string_to_array(${areaList},','),FALSE,120,${expiresAt}
        FROM stripe_accounts WHERE id=${account} AND test_key_enc IS NOT NULL
          AND live_enabled=FALSE RETURNING client_id`;
      return rows.length===1;
    },
    async createRtcPass({id,account,token,mode='test',profile='read_only',
      areas,allowWrites=false,moneyLimitCents=0,forHub=false,
      rateLimitPerMinute=120,expiresAt}) {
      // The issuer authenticates the owner; storage still enforces the exact
      // requested grants and usable TEST provider credentials independently.
      if(typeof id!=='string'||!/^rtc-agent-[a-z0-9-]{8,80}$/.test(id)||
        typeof account!=='string'||!/^acct_[A-Za-z0-9]{2,100}$/.test(account)||
        typeof token!=='string'||!/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(token)||
        mode!=='test'||!['read_only','everyday','full'].includes(profile)||
        typeof allowWrites!=='boolean'||allowWrites&&profile==='read_only'||
        typeof forHub!=='boolean'||!Number.isSafeInteger(moneyLimitCents)||
        moneyLimitCents<0||moneyLimitCents>0&&!allowWrites||
        !Number.isInteger(rateLimitPerMinute)||rateLimitPerMinute<1||
        rateLimitPerMinute>600||
        !Array.isArray(areas)||areas.length<1||areas.length>6||
        areas.some(a=>typeof a!=='string'||!/^[a-z][a-z_]{0,49}$/.test(a))||
        new Set(areas).size!==areas.length||
        !(expiresAt instanceof Date)||!Number.isFinite(expiresAt.getTime())||
        expiresAt.getTime()<=Date.now()||
        expiresAt.getTime()>Date.now()+(forHub?365:30)*86_400_000+60_000)
        throw new TypeError('Invalid original owner-selected RTC TEST pass grant');
      const areaList=areas.join(',');
      const rows=await sql`INSERT INTO oauth_tokens
        (token_hash,client_id,stripe_account,mode,profile,listing,kind,
         allow_writes,money_limit_cents,areas,for_hub,rate_limit_per_minute,expires_at)
        SELECT ${hashToken(token)},${id},id,'test',${profile},'compact','pass',
          ${allowWrites},${moneyLimitCents},string_to_array(${areaList},','),
          ${forHub},${rateLimitPerMinute},${expiresAt}
        FROM stripe_accounts WHERE id=${account} AND test_key_enc IS NOT NULL
        RETURNING client_id`;
      return rows.length===1;
    },
    async getRtcPassStatus(token) {
      if(typeof token!=='string'||!/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(token))return null;
      const rows=await sql`SELECT client_id,stripe_account,mode,profile,listing,
        kind,result_scope,allow_writes,money_limit_cents,areas,for_hub,
        rate_limit_per_minute,expires_at,revoked_at
        FROM oauth_tokens WHERE token_hash=${hashToken(token)} AND kind='pass'`;
      return rows[0]??null;
    },
    async consumeRtcPassRate({token,limit,units=1}) {
      if(typeof token!=='string'||!/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(token)||
        (!Number.isInteger(limit)||limit<1||limit>600)||
        !Number.isInteger(units)||units<1||units>10)
        throw new TypeError('Valid RTC TEST rate selector required');
      const rows=await sql`INSERT INTO rtc_pass_rates (token_hash,window_start,count)
        VALUES (${hashToken(token)},date_trunc('minute',now()),${units})
        ON CONFLICT (token_hash,window_start) DO UPDATE SET
          count=rtc_pass_rates.count+${units} RETURNING count`;
      return Number(rows[0]?.count)<=limit;
    },
    async getRtcPass(token) {
      if(typeof token!=='string'||!/^rtc_pass_[A-Za-z0-9_-]{43}$/.test(token))return null;
      const rows=await sql`SELECT client_id,stripe_account,mode,profile,listing,
        kind,result_scope,allow_writes,money_limit_cents,areas,for_hub,
        rate_limit_per_minute,expires_at,revoked_at
        FROM oauth_tokens WHERE token_hash=${hashToken(token)} AND kind='pass'
          AND revoked_at IS NULL AND expires_at>now()`;
      return rows[0]??null;
    },
    async getAccessToken(accessToken) {
      if (typeof accessToken !== 'string' || !accessToken) return null;
      const rows = await sql`SELECT client_id, stripe_account, mode, profile, listing, kind, result_scope,
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
          AND t.client_id=${clientId} AND t.kind IN ('connector','pass') AND t.revoked_at IS NULL)
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
            AND t.kind IN ('connector','pass') AND t.revoked_at IS NULL)
        RETURNING i.stripe_account,i.client_id
      ), revoked AS (
        UPDATE oauth_tokens t SET revoked_at=now()
        FROM consumed i WHERE t.stripe_account=i.stripe_account
          AND t.client_id=i.client_id AND t.kind IN ('connector','pass') AND t.revoked_at IS NULL
        RETURNING t.stripe_account,t.client_id
      )
      INSERT INTO change_log (stripe_account,mode,tool,target,summary,dry_run)
      SELECT stripe_account,'test','stripe_revoke_connection',client_id,
        'Owner revoked this account connection from the private setup page',FALSE
      FROM revoked LIMIT 1 RETURNING id`;
      return rows.length===1;
    },
    async requestMoneyApproval({ account, idempotencyKey, tool, description,
      amountCents, currency, target = '', mode = 'test' }) {
      if (![account,idempotencyKey,tool,description].every(v => typeof v==='string' && v.length>0) ||
          !/^acct_[A-Za-z0-9]+$/.test(account) || description.length>240 ||
          !Number.isSafeInteger(amountCents) || amountCents<=0 ||
          currency!=='usd' || mode!=='test' ||
          typeof target!=='string' ||
          (target!=='' && !/^(?:ch|py|po|tr|re|pi|in|cus|acct|ba|src|pm|sub|txn|bt|du)_[A-Za-z0-9]{2,100}$/.test(target))) {
        throw new TypeError('A safe, provider-derived TEST money identity is required');
      }
      // Empty targets preserve old unapproved test fixtures, but can NEVER
      // receive an owner grant. The owner inbox excludes them completely.
      await sql`INSERT INTO money_approvals
        (stripe_account,request_key,tool,description,amount_cents,currency,
          target,mode,expires_at)
        VALUES (${account},${idempotencyKey},${tool},${description},${amountCents},
          ${currency},${target},${mode},now()+interval '24 hours')
        ON CONFLICT (stripe_account,request_key) DO NOTHING`;
      const rows=await sql`SELECT tool,amount_cents,currency,description,target,mode,
        consumed_at,expires_at FROM money_approvals WHERE stripe_account=${account}
        AND request_key=${idempotencyKey}`;
      const row=rows[0];
      return !!row && row.tool===tool && Number(row.amount_cents)===amountCents &&
        row.currency===currency && row.description===description &&
        row.target===target && row.mode===mode &&
        row.consumed_at===null && new Date(row.expires_at).getTime()>Date.now();
    },
    async listPendingMoneyApprovals({account,limit=10}) {
      if(typeof account!=='string'||!/^acct_[A-Za-z0-9]+$/.test(account)||
          !Number.isInteger(limit)||limit<1||limit>20)
        throw new TypeError('Selected account and page size 1..20 required');
      // No client tokens, passphrases, Stripe secrets or raw provider data.
      return await sql`SELECT request_key,tool,target,description,amount_cents,
        currency,mode,created_at,expires_at,approved_at,override_approved_at,
        allow_over_limit
        FROM money_approvals
        WHERE stripe_account=${account} AND mode='test' AND target <> ''
          AND consumed_at IS NULL AND expires_at>now()
        ORDER BY created_at DESC,id DESC LIMIT ${limit}`;
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
          AND mode='test' AND target <> ''
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
          AND mode='test' AND target <> ''
        RETURNING request_key`;
      return rows.length === 1;
    },

    // These decisions are ONLY staged by the password/CSRF-protected owner page.
    // Each intent snapshots the complete provider-derived TEST request identity;
    // no browser field or AI argument supplies the amount or target.
    async requestMoneyDecisionIntent({id,account,idempotencyKey,kind,expiresAt}) {
      if(typeof id!=='string'||!/^[A-Za-z0-9_-]{32,64}$/.test(id)||
        typeof account!=='string'||!/^acct_[A-Za-z0-9]+$/.test(account)||
        typeof idempotencyKey!=='string'||!idempotencyKey||idempotencyKey.length>250||
        !['approve','override'].includes(kind)||!(expiresAt instanceof Date)||
        !Number.isFinite(expiresAt.getTime())||expiresAt.getTime()<=Date.now()||
        expiresAt.getTime()>Date.now()+600000) throw new TypeError('Valid TEST owner decision required');
      const rows=await sql`INSERT INTO owner_money_decision_intents
        (id,approval_id,stripe_account,request_key,tool,target,amount_cents,currency,mode,
          request_expires_at,kind,expires_at)
        SELECT ${id},m.id,m.stripe_account,m.request_key,m.tool,m.target,m.amount_cents,
          m.currency,m.mode,m.expires_at,${kind},${expiresAt}
        FROM money_approvals m JOIN stripe_accounts a ON a.id=m.stripe_account
        WHERE m.stripe_account=${account} AND m.request_key=${idempotencyKey}
          AND m.mode='test' AND m.target<>'' AND m.currency='usd'
          AND m.consumed_at IS NULL AND m.expires_at>now() AND a.test_key_enc IS NOT NULL
          AND ((
            ${kind}='approve' AND (m.approved_at IS NULL OR
              m.approved_at<=now()-interval '10 minutes')
          ) OR (
            ${kind}='override' AND m.approved_at>now()-interval '10 minutes'
            AND m.allow_over_limit=FALSE AND
            (SELECT COALESCE(SUM(r.amount_cents),0)::BIGINT
              FROM money_reservations r WHERE r.stripe_account=a.id
                AND r.local_day=(now() AT TIME ZONE 'America/Denver')::date
                AND r.state<>'rejected') > a.money_limit_cents::BIGINT-m.amount_cents
          ))
        RETURNING id`;
      return rows.length===1;
    },
    async getMoneyDecisionIntent(id) {
      if(typeof id!=='string'||!/^[A-Za-z0-9_-]{32,64}$/.test(id))return null;
      const rows=await sql`SELECT i.id,i.kind,i.stripe_account,i.request_key,i.tool,i.target,
          i.amount_cents,i.currency,i.mode,i.request_expires_at,i.expires_at
        FROM owner_money_decision_intents i
        JOIN money_approvals m ON m.id=i.approval_id
        JOIN stripe_accounts a ON a.id=i.stripe_account
        WHERE i.id=${id} AND i.consumed_at IS NULL AND i.expires_at>now()
          AND a.test_key_enc IS NOT NULL AND m.consumed_at IS NULL
          AND m.expires_at>now() AND m.expires_at=i.request_expires_at
          AND m.stripe_account=i.stripe_account AND m.request_key=i.request_key
          AND m.tool=i.tool AND m.target=i.target AND m.amount_cents=i.amount_cents
          AND m.currency=i.currency AND m.mode=i.mode AND m.mode='test'
          AND m.target<>''
          AND ((i.kind='approve' AND (m.approved_at IS NULL OR
                m.approved_at<=now()-interval '10 minutes'))
            OR (i.kind='override' AND m.approved_at>now()-interval '10 minutes'
                AND m.allow_over_limit=FALSE))
        LIMIT 1`;
      return rows[0]||null;
    },
    async consumeMoneyDecisionIntent(id) {
      if(typeof id!=='string'||!/^[A-Za-z0-9_-]{32,64}$/.test(id))return false;
      // Single statement: concurrent owner browsers cannot consume an intent
      // twice; audit failure rolls back both the grant and intent consumption.
      // The account's current day cap is rechecked for a separate override.
      const rows=await sql`WITH granted AS (
        UPDATE money_approvals m
        SET approved_at=CASE WHEN i.kind='approve' THEN now() ELSE m.approved_at END,
          allow_over_limit=(i.kind='override'),
          override_approved_at=CASE WHEN i.kind='override' THEN now() ELSE NULL END
        FROM owner_money_decision_intents i, stripe_accounts a
        WHERE i.id=${id} AND i.consumed_at IS NULL AND i.expires_at>now()
          AND m.id=i.approval_id AND a.id=i.stripe_account
          AND a.test_key_enc IS NOT NULL AND m.consumed_at IS NULL
          AND m.expires_at>now() AND m.expires_at=i.request_expires_at
          AND m.stripe_account=i.stripe_account AND m.request_key=i.request_key
          AND m.tool=i.tool AND m.target=i.target AND m.amount_cents=i.amount_cents
          AND m.currency=i.currency AND m.mode=i.mode AND m.mode='test'
          AND m.target<>'' AND m.currency='usd'
          AND ((
            i.kind='approve' AND (m.approved_at IS NULL OR
              m.approved_at<=now()-interval '10 minutes')
          ) OR (
            i.kind='override' AND m.approved_at>now()-interval '10 minutes'
            AND m.allow_over_limit=FALSE AND
            (SELECT COALESCE(SUM(r.amount_cents),0)::BIGINT FROM money_reservations r
              WHERE r.stripe_account=a.id
                AND r.local_day=(now() AT TIME ZONE 'America/Denver')::date
                AND r.state<>'rejected') > a.money_limit_cents::BIGINT-m.amount_cents
          ))
        RETURNING i.id,i.kind,m.stripe_account,m.request_key,m.target,m.amount_cents
      ), consumed AS (
        UPDATE owner_money_decision_intents i SET consumed_at=now()
        FROM granted g WHERE i.id=g.id AND i.consumed_at IS NULL
        RETURNING i.id
      )
      INSERT INTO change_log (stripe_account,mode,tool,target,summary,dry_run,
        amount_cents,currency,idempotency_key)
      SELECT g.stripe_account,'test',
        CASE WHEN g.kind='override' THEN 'owner_override_money_out'
          ELSE 'owner_approve_money_out' END,
        g.target,CASE WHEN g.kind='override' THEN
          'Owner separately approved this exact TEST transaction above the daily cap'
          ELSE 'Owner independently approved this exact TEST money-out request' END,
        FALSE,g.amount_cents,'usd',g.request_key
      FROM granted g JOIN consumed c ON c.id=g.id RETURNING id`;
      return rows.length===1;
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

    // A private handle belongs to one stable OAuth connection record. The
    // opaque result_scope is created server-side and survives refresh rotation.
    async putScopedResult({handle,connection,body,summary,expiresAt}) {
      if(typeof handle!=='string'||!/^res_[A-Za-z0-9_-]{24,48}$/.test(handle)||
        typeof connection!=='string'||!/^[0-9a-f-]{36}$/.test(connection)||
        typeof summary!=='string'||summary.length>200||!body||typeof body!=='object'||
        !(expiresAt instanceof Date)||!Number.isFinite(expiresAt.getTime())||
        expiresAt.getTime()<=Date.now()||
        expiresAt.getTime()>Date.now()+86400000) throw new TypeError('Valid scoped result required');
      await sql`WITH expired AS (
        SELECT handle FROM result_store WHERE expires_at<=now()
        ORDER BY expires_at LIMIT 100
      ), cleaned AS (DELETE FROM result_store WHERE handle IN (SELECT handle FROM expired))
      INSERT INTO result_store(handle,connection,summary,body,expires_at)
      VALUES (${handle},${connection},${summary},${JSON.stringify(body)}::jsonb,${expiresAt})`;
    },
    async getScopedResult({handle,connection}) {
      if(typeof handle!=='string'||!/^res_[A-Za-z0-9_-]{24,48}$/.test(handle)||
        typeof connection!=='string'||!/^[0-9a-f-]{36}$/.test(connection))return null;
      const rows=await sql`SELECT summary,body,expires_at FROM result_store
        WHERE handle=${handle} AND connection=${connection}
          AND expires_at>now()`;
      return rows[0]||null;
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
      return await sql`SELECT client_id, mode, profile, listing, kind, rate_limit_per_minute, created_at,
          last_used_at, expires_at, revoked_at
        FROM oauth_tokens WHERE stripe_account = ${account} AND kind IN ('connector','pass')
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
        result_scope TEXT NOT NULL DEFAULT gen_random_uuid()::text,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      // Older OAuth connections receive one stable, opaque result scope.
      await sql`ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS
        result_scope TEXT NOT NULL DEFAULT gen_random_uuid()::text`;
      await sql`ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS allow_writes BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS money_limit_cents INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS areas TEXT[]`;
      await sql`ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS for_hub BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE oauth_tokens ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER NOT NULL DEFAULT 120`;
      await sql`CREATE TABLE IF NOT EXISTS rtc_pass_rates (
        token_hash TEXT NOT NULL, window_start TIMESTAMPTZ NOT NULL,
        count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(token_hash,window_start)
      )`;
      await sql`CREATE INDEX IF NOT EXISTS rtc_pass_rates_window_idx ON rtc_pass_rates(window_start)`;
      await sql`CREATE TABLE IF NOT EXISTS result_store (
        handle TEXT PRIMARY KEY,
        connection TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        summary TEXT NOT NULL,
        body JSONB NOT NULL
      )`;
      await sql`CREATE INDEX IF NOT EXISTS result_store_expires
        ON result_store(expires_at)`;
      await sql`CREATE INDEX IF NOT EXISTS result_store_scope
        ON result_store(connection,expires_at)`;
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
      await sql`ALTER TABLE money_approvals
        ADD COLUMN IF NOT EXISTS target TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE money_approvals
        ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'test'`;
      await sql`CREATE INDEX IF NOT EXISTS money_approvals_verified_pending_idx
        ON money_approvals (stripe_account, expires_at)
        WHERE consumed_at IS NULL AND target <> ''`;
      await sql`CREATE INDEX IF NOT EXISTS money_approvals_pending_idx
        ON money_approvals (stripe_account, expires_at) WHERE consumed_at IS NULL`;
      await sql`CREATE TABLE IF NOT EXISTS owner_money_decision_intents (
        id TEXT PRIMARY KEY,
        approval_id BIGINT NOT NULL REFERENCES money_approvals(id),
        stripe_account TEXT NOT NULL REFERENCES stripe_accounts(id),
        request_key TEXT NOT NULL,
        tool TEXT NOT NULL,
        target TEXT NOT NULL,
        amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
        currency TEXT NOT NULL CHECK (currency='usd'),
        mode TEXT NOT NULL CHECK (mode='test'),
        request_expires_at TIMESTAMPTZ NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('approve','override')),
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS owner_money_decision_expiry_idx
        ON owner_money_decision_intents (expires_at)`;
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
        v_pass RECORD;
        v_pass_used BIGINT;
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
        -- A service-owned RTC pass has an additional OWNER-CHOSEN daily
        -- ceiling. The account row lock above serializes this comparison
        -- with every other reservation, including a second serverless worker.
        -- Unlike a preflight read, the test and reservation live in this same
        -- SQL transaction. Revoked/expired passes never acquire spend power.
        SELECT stripe_account,mode,profile,allow_writes,money_limit_cents,
               expires_at,revoked_at INTO v_pass
          FROM oauth_tokens WHERE result_scope=p_connection AND kind='pass'
          FOR UPDATE;
        IF FOUND THEN
          IF v_pass.stripe_account IS DISTINCT FROM p_account
             OR v_pass.mode <> 'test' OR v_pass.profile = 'read_only'
             OR v_pass.allow_writes IS NOT TRUE
             OR v_pass.revoked_at IS NOT NULL OR v_pass.expires_at<=now()
             OR v_pass.money_limit_cents IS NULL OR v_pass.money_limit_cents<=0 THEN
            decision := 'delegated_pass_denied'; used_cents := 0;
            limit_cents := 0; RETURN NEXT; RETURN;
          END IF;
          SELECT COALESCE(SUM(amount_cents),0)::BIGINT INTO v_pass_used
            FROM money_reservations
            WHERE connection=p_connection AND local_day=v_day
              AND state <> 'rejected';
          IF p_cents > v_pass.money_limit_cents::BIGINT-v_pass_used THEN
            decision := 'delegated_limit_exceeded';
            used_cents := v_pass_used;
            limit_cents := v_pass.money_limit_cents;
            RETURN NEXT; RETURN;
          END IF;
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
        SELECT amount_cents, currency, approved_at, allow_over_limit, override_approved_at, consumed_at, expires_at, target, mode
          INTO v_approval FROM money_approvals
          WHERE stripe_account = p_account AND request_key = p_key FOR UPDATE;
        IF NOT FOUND OR v_approval.amount_cents <> p_cents OR v_approval.currency <> p_currency
          OR v_approval.approved_at IS NULL OR v_approval.consumed_at IS NOT NULL
          OR v_approval.target IS NULL OR v_approval.target='' OR v_approval.mode<>'test'
          OR v_approval.expires_at <= now()
          OR v_approval.approved_at < now() - interval '10 minutes' THEN
          decision := 'owner_approval_required';
          RETURN NEXT; RETURN;
        END IF;
        IF v_used > limit_cents - p_cents AND (v_approval.allow_over_limit IS NOT TRUE
          OR v_approval.override_approved_at IS NULL
          OR v_approval.override_approved_at < v_approval.approved_at) THEN
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
      await initWebhookCreationTables(sql);
      await initWebhookSignatureTables(sql);
      await initTestWebhookReceiptTables(sql);
       await initDevRunTables(sql);
      await initBrandKitTables(sql);
      await initAppProfileTables(sql);
      await initDevForwarderTables(sql);
      await initDevForwarderReplayTables(sql);
      await initDevSimulationCycleTables(sql);
    }
  };
}

export async function initSchema() {
  return createDb().initSchema();
}
