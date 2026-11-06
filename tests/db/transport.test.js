import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  openIsolatedSchema, closeIsolatedSchema, rawQuery,
} from '../../test/helpers/pg-neon-adapter.js';

// S-1 (RACK-STAGING): the production store seam itself, exercised the
// way production calls it — createDb() with NO injected handle, the
// environment selecting the pg transport (src/db-transport.js) against
// a plain Postgres store. Every other db test injects the test
// adapter; this one proves the promoted production path end to end:
// selection, schema init, a write/read round trip, and the health
// probe through the same transport. The isolated schema is reached by
// carrying search_path in the connection string's options parameter,
// which node-postgres forwards to the server at startup.
let db;
let schema;
let storeUrl;
let savedEnv;

beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL ||
    !['localhost', '127.0.0.1', '::1'].includes(new URL(process.env.TEST_DATABASE_URL).hostname)) {
    throw new Error('S-1 transport test requires disposable localhost PostgreSQL');
  }
  schema = await openIsolatedSchema(process.env.TEST_DATABASE_URL);
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set('options', `-c search_path=${schema}`);
  storeUrl = url.toString();
  savedEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    STORE_TRANSPORT: process.env.STORE_TRANSPORT,
  };
  process.env.DATABASE_URL = storeUrl;
  process.env.STORE_TRANSPORT = 'pg';
  // Imported only after the environment is set: src/db.js memoizes the
  // production handle from the environment at first use.
  const mod = await import('../../src/db.js');
  db = mod.createDb();
  await db.initSchema();
});

afterAll(async () => {
  const { pgStoreSql } = await import('../../src/db-transport.js');
  await pgStoreSql(storeUrl).end();
  if (savedEnv.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = savedEnv.DATABASE_URL;
  if (savedEnv.STORE_TRANSPORT === undefined) delete process.env.STORE_TRANSPORT;
  else process.env.STORE_TRANSPORT = savedEnv.STORE_TRANSPORT;
  await closeIsolatedSchema();
});

describe('S-1 production pg transport (no injected handle)', () => {
  it('initializes the full schema through the seam', async () => {
    const rows = await rawQuery(
      `SELECT count(*)::integer AS n FROM information_schema.tables WHERE table_schema = '${schema}'`);
    expect(rows[0].n).toBeGreaterThanOrEqual(35);
  });

  it('round-trips a registration write and read through createDb()', async () => {
    await db.createOAuthClient({
      clientId: 'rack-staging-transport',
      clientSecret: 'fixture-secret',
      redirectUris: ['https://fixture.example/cb'],
      clientName: 'RACK-STAGING transport proof',
    });
    const got = await db.getOAuthClient('rack-staging-transport');
    expect(got.client_id).toBe('rack-staging-transport');
    expect(got.client_name).toBe('RACK-STAGING transport proof');
    const listed = await db.listOAuthClients();
    expect(listed.map((c) => c.client_id)).toContain('rack-staging-transport');
  });

  it('answers the health probe through the same transport', async () => {
    const { checkDatabase } = await import('../../src/health.js');
    await expect(checkDatabase({
      DATABASE_URL: storeUrl, STORE_TRANSPORT: 'pg',
    })).resolves.toBe(true);
    const dead = new URL(process.env.TEST_DATABASE_URL);
    dead.port = '9';
    await expect(checkDatabase({
      DATABASE_URL: dead.toString(), STORE_TRANSPORT: 'pg',
    })).resolves.toBe(false);
  });
});
