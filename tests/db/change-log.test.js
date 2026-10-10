import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb } from '../../src/db.js';
import { openIsolatedSchema, closeIsolatedSchema, neonShapedQuery, rawQuery } from '../../test/helpers/pg-neon-adapter.js';
let db;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL ||
    !['localhost', '127.0.0.1', '::1'].includes(new URL(process.env.TEST_DATABASE_URL).hostname)) {
    throw new Error('B-1a database test requires disposable localhost PostgreSQL');
  }
  await openIsolatedSchema(process.env.TEST_DATABASE_URL);
  db = createDb(neonShapedQuery());
  await db.initSchema();
});
afterAll(async () => { await closeIsolatedSchema(); });
describe('B-1a audit persistence in real isolated PostgreSQL', () => {
  it('keeps preview and verified-write records with idempotency and inverse', async () => {
    const key = 'rmcp_test_write_' + 'a'.repeat(64);
    await db.recordChange({ account: 'acct_fake', mode: 'test', connection: 'fake-connection',
      tool: 'stripe_test_write', summary: 'Preview fake write', dryRun: true });
    await db.recordChange({ account: 'acct_fake', mode: 'test', connection: 'fake-connection',
      tool: 'stripe_test_write', summary: 'Confirmed fake write', dryRun: false,
      idempotencyKey: key, inverse: { tool: 'stripe_test_restore', args: { id: 'fixture' } } });
    const rows = await rawQuery('SELECT stripe_account, mode, dry_run, summary, idempotency_key, inverse FROM change_log ORDER BY id');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ stripe_account: 'acct_fake', dry_run: true });
    expect(rows[1]).toMatchObject({ mode: 'test', dry_run: false, idempotency_key: key,
      inverse: { tool: 'stripe_test_restore', args: { id: 'fixture' } } });
  });
});
