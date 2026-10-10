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
  const reserve = async (key, amountCents = 30000, client = db,
    allowOverLimit = false, selectedConnection = connection) => {
    await client.requestMoneyApproval({account, idempotencyKey:key,
      tool:'stripe_fake_payout',description:'Verified payout',
      amountCents,currency:'usd'});
    await client.approveMoneyRequest({account,idempotencyKey:key});
    if (allowOverLimit) await client.approveMoneyOverride({account,idempotencyKey:key});
    return client.reserveMoneyOut({ account, connection:selectedConnection, idempotencyKey:key,
      amountCents, currency:'usd' });
  };
  it('does not let two serverless connections exceed the same limit', async () => {
    const pair = await Promise.all([reserve('once-A'), reserve('once-B', 30000, otherDb)]);
    expect(pair.map(x => x.decision).sort()).toEqual(['limit_exceeded_override_required', 'reserved']);
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
  it('shares one account ceiling across AI connections, with an explicit extra override', async () => {
    const denied = await reserve('other-connection', 40000, db, false, 'owner-client-2');
    expect(denied.decision).toBe('limit_exceeded_override_required');
    expect(Number((await db.getMoneyUsage({ account, connection:'owner-client-2' })).used_cents)).toBe(30000);
    const permitted = await reserve('other-connection', 40000, db, true, 'owner-client-2');
    expect(permitted.decision).toBe('reserved');
    expect(Number((await db.getMoneyUsage({ account, connection })).used_cents)).toBe(70000);
    expect(Number((await db.getMoneyUsage({ account, connection: 'owner-client-2' })).used_cents)).toBe(70000);
    expect((await db.reserveMoneyOut({account,connection:'owner-client-3',
      idempotencyKey:'other-connection',amountCents:40000,currency:'usd'})).decision)
      .toBe('already_reserved');
  });
  it('refuses to mix EUR or zero-decimal JPY into the USD daily dollar cap', async () => {
    const usedBefore = Number((await db.getMoneyUsage({ account, connection })).used_cents);
    for (const currency of ['eur', 'jpy']) {
      const response = await db.reserveMoneyOut({ account, connection,
        idempotencyKey: 'reject-' + currency, amountCents: 10000, currency });
      expect(response.decision).toBe('currency_unsupported');
    }
    expect(Number((await db.getMoneyUsage({ account, connection })).used_cents)).toBe(usedBefore);
  });
  it('upgrades the older three-state constraint once without removing ledger records', async () => {
    await rawQuery('ALTER TABLE money_reservations DROP CONSTRAINT money_reservations_state_check');
    await rawQuery("ALTER TABLE money_reservations ADD CONSTRAINT money_reservations_state_check CHECK (state IN ('reserved', 'confirmed', 'uncertain'))");
    await db.initSchema();
    const constraints = await rawQuery(`SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE conrelid = 'money_reservations'::regclass
      AND conname = 'money_reservations_state_check'`);
    expect(constraints).toHaveLength(1);
    expect(constraints[0].definition).toContain('rejected');
    await db.initSchema();
    expect((await reserve('once-A')).decision).toBe('already_uncertain');
  });
  it('requires a separate owner decision for every request even in TEST mode', async () => {
    const input={account,connection,idempotencyKey:'owner-not-approved',
      amountCents:100,currency:'usd'};
    expect((await db.reserveMoneyOut(input)).decision).toBe('owner_approval_required');
    expect(await db.requestMoneyApproval({account,idempotencyKey:input.idempotencyKey,
      amountCents:100,currency:'usd',tool:'stripe_fake_refund',description:'Refund'})).toBe(true);
    expect((await db.reserveMoneyOut(input)).decision).toBe('owner_approval_required');
    expect(await db.approveMoneyRequest({account,idempotencyKey:input.idempotencyKey,
      allowOverLimit:false})).toBe(true);
    expect((await db.reserveMoneyOut(input)).decision).toBe('limit_exceeded_override_required');
    expect(await db.approveMoneyOverride({account,idempotencyKey:input.idempotencyKey})).toBe(true);
    expect((await db.reserveMoneyOut(input)).decision).toBe('reserved');
    await expect(db.approveMoneyRequest({account,idempotencyKey:input.idempotencyKey,
      allowOverLimit:true})).rejects.toThrow(/Separate|over-limit/i);
    expect(await db.approveMoneyOverride({account,idempotencyKey:input.idempotencyKey})).toBe(false);
    // Release only this test fixture from usage as a confirmed decline; keep its key spent.
    expect(await db.settleMoneyReservation({ ...input,state:'rejected' })).toBe(true);
  });
  it('releases a proven rejection without allowing replay of the same request ID', async () => {
    const before = Number((await db.getMoneyUsage({ account, connection })).used_cents);
    const attempt = await reserve('definitely-declined', 12500, db, true);
    expect(attempt.decision).toBe('reserved');
    expect(await db.settleMoneyReservation({ account, connection,
      idempotencyKey: 'definitely-declined', state: 'rejected' })).toBe(true);
    expect(await db.settleMoneyReservation({ account, connection,
      idempotencyKey: 'definitely-declined', state: 'confirmed' })).toBe(false);
    expect((await reserve('definitely-declined', 12500)).decision).toBe('already_rejected');
    expect(Number((await db.getMoneyUsage({ account, connection })).used_cents)).toBe(before);
  });
  it('reports a nonexistent account as unavailable rather than silently allowing it', async () => {
    const res = await db.reserveMoneyOut({ account: 'acct_unknown', connection,
      idempotencyKey: 'orphan', amountCents: 100, currency: 'usd' });
    expect(res.decision).toBe('account_missing');
  });
});
