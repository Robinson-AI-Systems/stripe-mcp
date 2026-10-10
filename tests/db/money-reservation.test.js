import pg from 'pg';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createDb } from '../../src/db.js';
import { openIsolatedSchema, closeIsolatedSchema, rawQuery, neonShapedQuery } from '../../test/helpers/pg-neon-adapter.js';

let db, otherDb, other;
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname)) {
    throw new Error('Use disposable localhost PostgreSQL only');
  }
  const schema = await openIsolatedSchema(url);
  db = createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts (id, label, money_limit_cents) VALUES ($1, $2, $3)',
    ['acct_fake_budget', 'Fixture', 50000]);
  other = new pg.Client({ connectionString: url });
  await other.connect();
  await other.query('SET search_path TO "' + schema + '"');
  otherDb = createDb(async (segments, ...values) => {
    let text = segments[0];
    for (let i = 0; i < values.length; i++) text += '$' + (i + 1) + segments[i + 1];
    return (await other.query(text, values)).rows;
  });
});
afterAll(async () => {
  await other?.end();
  await closeIsolatedSchema();
});

describe('B-1b1 concurrent daily money-out reservation, no Stripe calls', () => {
  const account = 'acct_fake_budget';
  const connection = 'owner-client-1';
  const reserve = (key, amountCents = 30000, client = db) =>
    client.reserveMoneyOut({ account, connection, idempotencyKey: key,
      amountCents, currency: 'usd' });
  it('does not let two serverless connections exceed the same limit', async () => {
    const pair = await Promise.all([reserve('once-A'), reserve('once-B', 30000, otherDb)]);
    expect(pair.map(x => x.decision).sort()).toEqual(['limit_exceeded', 'reserved']);
    expect(Number((await db.getMoneyUsage({ account, connection })).used_cents)).toBe(30000);
  });
  it('never charges the limit twice for a replay or a mismatched amount', async () => {
    expect((await reserve('once-A')).decision).toBe('already_reserved');
    expect((await reserve('once-A', 10000)).decision).toBe('request_conflict');
    expect(Number((await db.getMoneyUsage({ account, connection })).used_cents)).toBe(30000);
  });
  it('refuses unsafe reservation state transitions and never frees uncertain spend', async () => {
    expect(await db.settleMoneyReservation({ account, connection,
      idempotencyKey: 'once-A', state: 'uncertain' })).toBe(true);
    expect(await db.settleMoneyReservation({ account, connection,
      idempotencyKey: 'once-A', state: 'confirmed' })).toBe(false);
    expect((await reserve('once-A')).decision).toBe('already_uncertain');
    expect(Number((await db.getMoneyUsage({ account, connection })).used_cents)).toBe(30000);
    await expect(db.settleMoneyReservation({ account, connection,
      idempotencyKey: 'once-A', state: 'released' })).rejects.toThrow();
  });
  it('keeps separate connections independent while applying the same account ceiling', async () => {
    const result = await db.reserveMoneyOut({ account, connection: 'owner-client-2',
      idempotencyKey: 'other-connection', amountCents: 40000, currency: 'usd' });
    expect(result.decision).toBe('reserved');
    expect(Number((await db.getMoneyUsage({ account, connection })).used_cents)).toBe(30000);
    expect(Number((await db.getMoneyUsage({ account, connection: 'owner-client-2' })).used_cents)).toBe(40000);
  });
  it('reports a nonexistent account as unavailable rather than silently allowing it', async () => {
    const res = await db.reserveMoneyOut({ account: 'acct_unknown', connection,
      idempotencyKey: 'orphan', amountCents: 100, currency: 'usd' });
    expect(res.decision).toBe('account_missing');
  });
});
