// Test-only fake that mirrors the A-2 schema and A-3 OAuth store behavior.
import { SCHEMA_TABLES, connectionSettings } from '../../src/db.js';
import { hashToken } from '../../src/core/oauth.js';

export function createFakeDb({ clock = () => Date.now(), accounts = [] } = {}) {
  const rows = new Map();
  const createdTables = new Set();
  const clients = new Map();
  const codes = new Map();
  const tokens = new Map();
  const attempts = [];
  const accountRows = new Map(accounts.map(a => [a.id, structuredClone(a)]));
  const encryptedTestKeys = new Map();
  const oneTimeSecrets = new Map();
  const audit = [];
  return {
    async initSchema() { for (const table of SCHEMA_TABLES) createdTables.add(table); },
    async listTables() { return [...createdTables].sort(); },
    async put(key, value) { rows.set(key, structuredClone(value)); },
    async get(key) { return rows.has(key) ? structuredClone(rows.get(key)) : null; },
    async createOAuthClient({ clientId, clientSecret, redirectUris, clientName }) {
      if (clients.has(clientId)) throw new Error('duplicate client');
      clients.set(clientId, { client_id: clientId, client_secret_hash: hashToken(clientSecret),
        redirect_uris: structuredClone(redirectUris), client_name: clientName || null });
    },
    async getOAuthClient(id) { return structuredClone(clients.get(id) || null); },
    async createAuthCode({ code, clientId, redirectUri, codeChallenge, codeChallengeMethod = 'S256',
      stripeAccount = null, mode = 'test', profile = 'everyday', listing = 'catalog', ttlSeconds = 600 }) {
      codes.set(hashToken(code), { client_id: clientId, redirect_uri: redirectUri,
        code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod,
        stripe_account: stripeAccount, mode, profile, listing, expires_at: clock() + ttlSeconds * 1000 });
    },
    async consumeAuthCode(code) {
      const key = hashToken(code);
      const row = codes.get(key);
      codes.delete(key);
      return row && row.expires_at > clock() ? structuredClone(Object.fromEntries(
        Object.entries(row).filter(([name]) => name !== 'expires_at'))) : null;
    },
    async createAccessToken({ accessToken, refreshToken, clientId, stripeAccount = null,
      mode = 'test', profile = 'everyday', listing = 'catalog', ttlSeconds = 3600 }) {
      tokens.set(hashToken(accessToken), { token_hash: hashToken(accessToken),
        refresh_hash: refreshToken ? hashToken(refreshToken) : null, client_id: clientId,
        stripe_account: stripeAccount, mode, profile, listing, kind: 'connector',
        expires_at: clock() + ttlSeconds * 1000, revoked_at: null });
    },
    async getAccessToken(accessToken) {
      const row = tokens.get(hashToken(accessToken));
      if (!row || row.revoked_at || row.expires_at <= clock()) return null;
      return { client_id: row.client_id, ...connectionSettings(row), kind: row.kind,
        expires_at: new Date(row.expires_at), revoked_at: null };
    },
    async getTokenByRefreshToken(refreshToken) {
      const key = hashToken(refreshToken);
      const row = [...tokens.values()].find((item) => item.refresh_hash === key &&
        !item.revoked_at);
      return row ? { client_id: row.client_id, ...connectionSettings(row) } : null;
    },
    async rotateRefreshToken({ refreshToken, clientId, accessToken, newRefreshToken,
      ttlSeconds = 3600 }) {
      const row = [...tokens.values()].find((item) => item.refresh_hash === hashToken(refreshToken) &&
        item.client_id === clientId && !item.revoked_at);
      if (!row) return null;
      tokens.delete(row.token_hash);
      row.token_hash = hashToken(accessToken);
      row.refresh_hash = hashToken(newRefreshToken);
      row.expires_at = clock() + ttlSeconds * 1000;
      tokens.set(row.token_hash, row);
      return { client_id: row.client_id, ...connectionSettings(row) };
    },
    async revokeAccessToken(accessToken) {
      const row = tokens.get(hashToken(accessToken));
      if (!row || row.revoked_at) return false;
      row.revoked_at = clock();
      return true;
    },
    async recordLoginAttempt(ip) {
      const id = attempts.length + 1;
      attempts.push({ id, ip, success: false, at: clock() });
      return id;
    },
    async markLoginAttemptSucceeded(id) {
      const row = attempts.find((a) => a.id === id);
      if (row) row.success = true;
    },
    async countRecentFailedLogins(ip, minutes) {
      return attempts.filter((a) => a.ip === ip && !a.success && a.at > clock() - minutes * 60000).length;
    },
    async listStripeAccounts() { return structuredClone([...accountRows.values()].map(a => ({
      ...a, test_connected: encryptedTestKeys.has(a.id), live_connected: false
    }))); },
    async getStripeAccount(id) {
      const account = accountRows.get(id);
      if (!account) return null;
      const saved = encryptedTestKeys.get(id);
      return structuredClone({ ...account, test_key_kind: saved?.kind || null,
        test_key_last4: saved?.last4 || null, key_permissions: saved?.permissions || {},
        money_limit_cents: 50000, test_connected: !!saved, live_connected: false });
    },
    async saveTestKey({ account, label, ciphertext, kind, last4, permissions = {} }) {
      const before = accountRows.get(account) || { id: account, is_default: accountRows.size === 0,
        live_enabled: false };
      accountRows.set(account, { ...before, label });
      encryptedTestKeys.set(account, { ciphertext, kind, last4, permissions: structuredClone(permissions) });
    },
    async getEncryptedKey({ account, mode }) {
      if (mode !== 'test') return null;
      const row = encryptedTestKeys.get(account);
      return row ? { ciphertext: row.ciphertext } : null;
    },
    async addOneTimeSecret({ id, account, mode, kind, ciphertext, expiresAt }) {
      oneTimeSecrets.set(id, { stripe_account: account, mode, kind, ciphertext,
        expires_at: new Date(expiresAt).getTime() });
    },
    async consumeOneTimeSecret(id) {
      const row = oneTimeSecrets.get(id);
      oneTimeSecrets.delete(id);
      return row && row.expires_at > clock() ? structuredClone(Object.fromEntries(
        Object.entries(row).filter(([name]) => name !== 'expires_at'))) : null;
    },
    async recordChange({ account = null, mode = 'test', connection = null,
      tool, summary, dryRun = false, idempotencyKey = null, inverse = null,
      amountCents = null, currency = null, direction = null }) {
      if (!tool || !summary) throw new TypeError('Tool and summary required for audit');
      const row = { id: audit.length + 1, stripe_account: account, mode, connection,
        tool, summary, dry_run: dryRun, idempotency_key: idempotencyKey,
        inverse: structuredClone(inverse), amount_cents: amountCents, currency, direction,
        at: new Date(clock()) };
      audit.push(row);
      return row.id;
    },
    async listAuditForTest() { return structuredClone(audit); },
    async tokenRowsForTest() { return structuredClone([...tokens.values()]); }
  };
}
