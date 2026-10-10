import { describe, expect, it } from 'vitest';
import { createFakeDb } from '../../test/helpers/fake-db.js';
describe('fake budget ledger mirrors fail-closed DB behavior', () => {
  it('blocks amounts above the configured amount and never releases uncertain usage', async () => {
    const db = createFakeDb({ accounts: [{ id: 'acct_budget', label: 'Fixture', money_limit_cents: 10000 }] });
    const args = { account: 'acct_budget', connection: 'agent', currency: 'usd' };
    const ownerApprove=async (key, cents, override=false) => {
      expect(await db.requestMoneyApproval({ account:args.account, idempotencyKey:key,
        tool:'stripe_fixture', description:'Owner-reviewed payout', amountCents:cents,
        currency:'usd' })).toBe(true);
      expect(await db.approveMoneyRequest({account:args.account,idempotencyKey:key,
        allowOverLimit:override})).toBe(true);
    };
    await ownerApprove('A',7500);
    expect((await db.reserveMoneyOut({ ...args, idempotencyKey: 'A', amountCents: 7500 })).decision).toBe('reserved');
    await ownerApprove('B',5000);
    expect((await db.reserveMoneyOut({ ...args, idempotencyKey: 'B', amountCents: 5000 })).decision)
      .toBe('limit_exceeded_override_required');
    expect((await db.reserveMoneyOut({ ...args, idempotencyKey: 'EUR',
      amountCents: 10, currency: 'eur' })).decision).toBe('currency_unsupported');
    expect(await db.settleMoneyReservation({ ...args, idempotencyKey: 'A', state: 'uncertain' })).toBe(true);
    expect((await db.getMoneyUsage({ account: 'acct_budget', connection: 'agent' })).used_cents).toBe(7500);
    expect((await db.reserveMoneyOut({ ...args, idempotencyKey: 'A', amountCents: 7500 })).decision).toBe('already_uncertain');
    await ownerApprove('C',2000);
    expect((await db.reserveMoneyOut({ ...args, idempotencyKey: 'C', amountCents: 2000 })).decision)
      .toBe('reserved');
    expect(await db.settleMoneyReservation({ ...args, idempotencyKey: 'C', state: 'rejected' })).toBe(true);
    expect((await db.getMoneyUsage({account:'acct_budget',connection:'agent'})).used_cents).toBe(7500);
    expect((await db.reserveMoneyOut({ ...args, idempotencyKey: 'C', amountCents: 2000 })).decision).toBe('already_rejected');
  });
});
