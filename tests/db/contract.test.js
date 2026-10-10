import { beforeAll, afterAll, expect, it } from 'vitest';
import { openIsolatedSchema, closeIsolatedSchema, rawQuery, neonShapedQuery } from '../../test/helpers/pg-neon-adapter.js';
import { runDbContract } from '../../test/contract/db-contract.js';

let sql;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to disposable localhost Postgres');
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('Refusing non-local Postgres in test');
  await openIsolatedSchema(process.env.TEST_DATABASE_URL);
  await rawQuery('CREATE TABLE contract_items (key TEXT PRIMARY KEY, value JSONB NOT NULL)');
  sql = neonShapedQuery();
});
afterAll(async () => { await closeIsolatedSchema(); });
runDbContract('isolated PostgreSQL', async () => ({
  async put(key, value) { await sql`INSERT INTO contract_items (key, value) VALUES (${key}, ${JSON.stringify(value)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`; },
  async get(key) { const rows = await sql`SELECT value FROM contract_items WHERE key = ${key}`; return rows[0]?.value ?? null; }
}));
it('accepts a parameterized query and can be initialized independently', async () => {
  expect((await sql`SELECT ${42}::integer AS answer`)[0].answer).toBe(42);
});
