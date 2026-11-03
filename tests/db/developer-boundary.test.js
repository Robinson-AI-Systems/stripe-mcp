// Fleet developer access boundary (Library D-001) against real PostgreSQL:
// the context column and the boundary journal are additive, grants
// round-trip their stamped context, and rotation preserves it.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createDb, SCHEMA_TABLES } from '../../src/db.js';
import { openIsolatedSchema, closeIsolatedSchema, neonShapedQuery, rawQuery } from '../../test/helpers/pg-neon-adapter.js';

let db;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must be a disposable localhost Postgres');
  if (!['localhost', '127.0.0.1', '::1'].includes(new URL(process.env.TEST_DATABASE_URL).hostname)) {
    throw new Error('Refusing a remote database');
  }
  await openIsolatedSchema(process.env.TEST_DATABASE_URL);
  db = createDb(neonShapedQuery());
  await db.initSchema();
});
afterAll(async () => { await closeIsolatedSchema(); });

describe('developer access boundary persistence', () => {
  it('adds the context column and the boundary journal table additively', async () => {
    expect(SCHEMA_TABLES).toContain('developer_boundary_events');
    const columns = await rawQuery(`SELECT data_type FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'oauth_tokens' AND column_name = 'context'`);
    expect(columns).toHaveLength(1);
    expect(columns[0].data_type).toBe('text');
    const tables = await rawQuery(`SELECT table_name FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = 'developer_boundary_events'`);
    expect(tables).toHaveLength(1);
  });
  it('round-trips developer context and preserves it through refresh rotation', async () => {
    await db.createAccessToken({ accessToken: 'dev-access', refreshToken: 'dev-refresh',
      clientId: 'dev-client', stripeAccount: 'acct_fake', mode: 'test', profile: 'full',
      listing: 'compact', context: 'developer' });
    expect((await db.getAccessToken('dev-access')).context).toBe('developer');
    expect((await db.getTokenByRefreshToken('dev-refresh')).context).toBe('developer');
    const rotated = await db.rotateRefreshToken({ refreshToken: 'dev-refresh', clientId: 'dev-client',
      accessToken: 'dev-access-2', newRefreshToken: 'dev-refresh-2' });
    expect(rotated.context).toBe('developer');
    expect((await db.getAccessToken('dev-access-2')).context).toBe('developer');
  });
  it('defaults grants created without a stamp to customer context', async () => {
    await db.createAccessToken({ accessToken: 'cust-access', refreshToken: 'cust-refresh',
      clientId: 'cust-client', stripeAccount: 'acct_fake', mode: 'test', profile: 'full',
      listing: 'compact' });
    expect((await db.getAccessToken('cust-access')).context).toBe('customer');
  });
  it('journals boundary events with identifiers and reason codes only', async () => {
    await db.recordDeveloperBoundaryEvent({ surface: 'mcp', context: 'developer', mode: 'live',
      reason: 'developer_live_access_refused', clientId: 'dev-client' });
    const rows = await rawQuery('SELECT surface, context, mode, reason, client_id FROM developer_boundary_events');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ surface: 'mcp', context: 'developer', mode: 'live',
      reason: 'developer_live_access_refused', client_id: 'dev-client' });
    await expect(db.recordDeveloperBoundaryEvent({ surface: 'mcp', context: 'developer', reason: '' }))
      .rejects.toThrow();
  });
});
