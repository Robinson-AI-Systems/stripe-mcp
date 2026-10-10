import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { openIsolatedSchema, closeIsolatedSchema, rawQuery, neonShapedQuery } from '../../test/helpers/pg-neon-adapter.js';
import { createDb, SCHEMA_TABLES } from '../../src/db.js';

let db;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to disposable localhost Postgres');
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('Refusing non-local Postgres in test');
  await openIsolatedSchema(process.env.TEST_DATABASE_URL);
  db = createDb(neonShapedQuery());
});
afterAll(async () => { await closeIsolatedSchema(); });

async function tables() {
  const rows = await rawQuery(`SELECT table_name FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_type = 'BASE TABLE'
    ORDER BY table_name`);
  return rows.map((r) => r.table_name);
}

describe('A-2 real Postgres schema', () => {
  it('creates the seven planned tables and survives repeat initialization', async () => {
    await db.initSchema();
    const once = await tables();
    expect(once).toEqual([...SCHEMA_TABLES].sort());
    await db.initSchema();
    expect(await tables()).toEqual(once);
  });

  it('stores only hashed OAuth tokens and connection settings (not plain token columns)', async () => {
    const rows = await rawQuery(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'oauth_tokens'`);
    const names = rows.map((x) => x.column_name);
    for (const field of ['token_hash', 'refresh_hash', 'stripe_account', 'mode', 'profile', 'listing', 'revoked_at']) {
      expect(names).toContain(field);
    }
    expect(names).not.toContain('access_token');
    expect(names).not.toContain('refresh_token');
    const hash = 'f'.repeat(64);
    await rawQuery('INSERT INTO oauth_tokens (token_hash, client_id, stripe_account) VALUES ($1, $2, $3)',
      [hash, 'client-1', 'acct_test_fixture']);
    const [row] = await rawQuery('SELECT mode, profile, listing, kind FROM oauth_tokens WHERE token_hash = $1', [hash]);
    expect(row).toEqual({ mode: 'test', profile: 'everyday', listing: 'catalog', kind: 'connector' });
  });

  it('defaults to disabled live mode and records only encrypted key slots', async () => {
    const cols = await rawQuery(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'stripe_accounts'`);
    const names = cols.map((r) => r.column_name);
    expect(names).toContain('test_key_enc');
    expect(names).toContain('live_key_enc');
    expect(names).not.toContain('test_key_plain');
    await rawQuery('INSERT INTO stripe_accounts (id, label) VALUES ($1, $2)', ['acct_test_fixture', 'Fixture']);
    const [row] = await rawQuery('SELECT live_enabled, money_limit_cents, is_default FROM stripe_accounts WHERE id = $1',
      ['acct_test_fixture']);
    expect(row).toEqual({ live_enabled: false, money_limit_cents: 50000, is_default: false });
  });

  it('has an encrypted one-time-secret slot and expiration indexes', async () => {
    const rows = await rawQuery(`SELECT column_name FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'one_time_secrets'`);
    expect(rows.map((r) => r.column_name)).toContain('ciphertext');
    expect(rows.map((r) => r.column_name)).not.toContain('plaintext');
    const indexes = await rawQuery(`SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()`);
    expect(indexes.map((r) => r.indexname)).toContain('oauth_tokens_expiration_idx');
    expect(indexes.map((r) => r.indexname)).toContain('one_time_secrets_expiration_idx');
  });
});
