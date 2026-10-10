// Seven-case contract fixture for the generic guarded Stripe write lifecycle.
// Never calls real Stripe; all provider behavior and audit persistence are injected.
import { describe, expect, it } from 'vitest';
import { defineWrite } from '../../src/tools/write.js';
import { idempotencyKey } from '../../src/stripe/client.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';

const parse = r => JSON.parse(r.content[0].text);
export function runWriteContract({ withMoney, tool = null, args = {}, fixtures = null }) {
  if ((tool || fixtures) && (typeof tool !== 'function' ||
      typeof fixtures !== 'function' || !args || Array.isArray(args) ||
      typeof args !== 'object')) {
    throw new TypeError('An actual tool contract requires tool factory, args and fixtures factory');
  }
  const title = withMoney ? 'money-out write' : 'non-money write';
  function fixture({ appOwned = false, readBackMatches = true, approved = true,
    moneyCents = 8500, limitCents = 10000 } = {}) {
    if (tool) {
      const built = fixtures({ appOwned, readBackMatches, approved, moneyCents, limitCents });
      const actual = tool(built, { appOwned, readBackMatches, approved, moneyCents, limitCents });
      if (typeof actual?.handler !== 'function') throw new TypeError('Supplied tool must expose its real handler');
      return { ...built, op: {
        ...actual,
        handler: (input, connectionCtx = built.ctx) => execute(actual, { ...args, ...input }, connectionCtx, built.db, approved)
      } };
    }
    const provider = { writes: [], afterCalls: 0 };
    const db = createFakeDb({ accounts: [{
      id: 'acct_safe_fixture', label: 'Fixture', money_limit_cents: limitCents }] });
    const connection = { stripeAccount: 'acct_safe_fixture', mode: 'test', profile: 'full' };
    const ctx = { connection, connectionId: 'owner-client-fixture',
      moneyPolicyApproved: approved, db };
    const op = defineWrite({
      name: withMoney ? 'stripe_test_refund' : 'stripe_test_update',
      read: async () => ({ refundableCents: moneyCents, appOwned, status: 'before' }),
      summarize: async () => 'Customer-approved fixture update. TEST MODE.',
      money: withMoney ? async (_args, _ctx, before) => ({
        amountCents: before.refundableCents, currency: 'usd', direction: 'out',
        description: 'Refund verified customer balance'
      }) : undefined,
      targetGuard: (args, _ctx, before) => !before.appOwned || args.outsideApp === true,
      apply: async (_args, _ctx, options) => provider.writes.push(options),
      readAfter: async () => { provider.afterCalls++; return { status: readBackMatches ? 'after' : 'before' }; },
      verify: async (_before, after) => after.status === 'after',
      inverse: async () => ({ tool: 'stripe_fixture_restore', args: { id: 'record' } })
    });
    return { provider, db, ctx, op: {
      ...op, handler: (input, connectionCtx = ctx) => execute(op, input, connectionCtx, db, approved)
    } };
  }
  // Test harness models two distinct actions: agent requests a transaction,
  // then an independently authenticated owner would approve it. The fake DB
  // test approval is never exposed through the production tool handler.
  async function execute(op, input, ctx, db, approved) {
    if (!withMoney || input.confirm !== true || input.dryRun === true) {
      return op.handler(input, ctx);
    }
    const first = await op.handler(input, ctx);
    if (!approved || !/explicit approval is required/.test(parse(first).error || '')) return first;
    const key = idempotencyKey(ctx.connection, op.tool.name, input);
    const granted = await db.approveMoneyRequest({
      account:ctx.connection.stripeAccount, idempotencyKey:key
    });
    if (!granted) throw new Error('Test fixture could not simulate owner authorization');
    return op.handler(input, ctx);
  }
  describe('seven-case write contract: ' + title, () => {
    it('1. dryRun returns a truthful preview; never applies or reserves', async () => {
      const { provider, db, ctx, op } = fixture();
      const result = parse(await op.handler({ dryRun: true, confirm: true }, ctx));
      expect(result.done).toBe(false);
      expect(result.preview).toContain('TEST MODE');
      if (withMoney) expect(result.preview.split('\n')[0]).toContain('$85.00');
      expect(provider.writes).toHaveLength(0);
      expect((await db.listAuditForTest())[0].dry_run).toBe(true);
      if (withMoney) expect((await db.getMoneyUsage({account:ctx.connection.stripeAccount,
        connection:ctx.connectionId})).used_cents).toBe(0);
    });
    it('2. missing confirmation never sends a provider write', async () => {
      const { provider, ctx, op } = fixture();
      const res = parse(await op.handler({}, ctx));
      expect(res.done).toBe(false);
      expect(res.needsConfirmation).toBe(true);
      expect(provider.writes).toHaveLength(0);
    });
    it('3. confirmation sends one idempotent write and independently reads back', async () => {
      const { provider, db, ctx, op } = fixture();
      const res = parse(await op.handler({ confirm: true, requestKey: 'case3' }, ctx));
      expect(res.done).toBe(true);
      expect(res.confirmed).toBe(true);
      expect(provider.writes).toHaveLength(1);
      expect(provider.writes[0].idempotencyKey).toBe(res.idempotencyKey);
      expect(provider.afterCalls).toBe(1);
      const log = await db.listAuditForTest();
      expect(log).toHaveLength(2);
      expect(log[1].dry_run).toBe(false);
      if (withMoney) {
        expect(log[1].amount_cents).toBe(8500);
        expect(log[1].direction).toBe('out');
      }
    });
    it('4. read-back mismatch is never described as a successful change', async () => {
      const { db, ctx, op } = fixture({readBackMatches: false});
      const res = parse(await op.handler({confirm:true,requestKey:'mismatch'},ctx));
      expect(res.done).toBe(false);
      expect(res.confirmed).toBe(false);
      expect(res.warning).toMatch(/Read-back/);
      if (withMoney) {
        expect((await db.getMoneyUsage({account:ctx.connection.stripeAccount,
          connection:ctx.connectionId})).used_cents).toBe(8500);
        const replay = parse(await op.handler({confirm:true,requestKey:'mismatch'},ctx));
        expect(replay.done).toBe(false);
      }
    });
    it('5. app-owned objects denied except an explicitly authorized exception', async () => {
      const { ctx, op, provider } = fixture({appOwned:true});
      expect(parse(await op.handler({confirm:true},ctx)).done).toBe(false);
      expect(provider.writes).toHaveLength(0);
      expect(parse(await op.handler({confirm:true,outsideApp:true},ctx)).done).toBe(true);
    });
    it('6. live-mode writes remain disabled even with confirm', async () => {
      const { ctx, op, provider } = fixture();
      expect(parse(await op.handler({confirm:true},{...ctx,
        connection:{...ctx.connection,mode:'live'}})).done).toBe(false);
      expect(provider.writes).toHaveLength(0);
    });
    it('7. provider-derived cents, dollar preview and daily cap are enforced', async () => {
      const { ctx, db, op, provider } = fixture({limitCents:10000});
      if (!withMoney) {
        const res = parse(await op.handler({confirm:true,amountCents:1},ctx));
        expect(res.done).toBe(true);
        return;
      }
      const preview = parse(await op.handler({dryRun:true,amountCents:1},ctx));
      expect(preview.preview.split('\n')[0]).toContain('$85.00');
      expect(parse(await op.handler({confirm:true,requestKey:'first',amountCents:1},ctx)).done).toBe(true);
      expect((await db.getMoneyUsage({account:ctx.connection.stripeAccount,
        connection:ctx.connectionId})).used_cents).toBe(8500);
      const denied = parse(await op.handler({confirm:true,requestKey:'second',amountCents:1},ctx));
      expect(denied.done).toBe(false);
      expect(denied.error).toMatch(/limit exceeded/i);
      expect(provider.writes).toHaveLength(1);
    });
  });
}
