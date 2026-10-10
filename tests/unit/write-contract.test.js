import { describe, expect, it } from 'vitest';
import { runWriteContract } from '../helpers/write-contract.js';
import { defineWrite } from '../../src/tools/write.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';
import { formatUsd } from '../../src/money.js';
import { idempotencyKey } from '../../src/stripe/client.js';
runWriteContract({withMoney:false});
runWriteContract({withMoney:true});
// The same seven checks must work with a supplied real write tool, not just
// this helper's internally constructed illustrative function. Each test case
// constructs independent provider/DB state, and executes that real handler.
runWriteContract({
  withMoney: true,
  args: { refundId: 're_fixture_real_handler' },
  fixtures: ({ appOwned, readBackMatches, approved, moneyCents, limitCents }) => {
    const db = createFakeDb({ accounts: [{ id: 'acct_safe_fixture', label: 'Fixture',
      money_limit_cents: limitCents }] });
    const provider = { writes: [], afterCalls: 0 };
    const ctx = { db, connectionId: 'owner-client-fixture', moneyPolicyApproved: approved,
      connection: { stripeAccount: 'acct_safe_fixture', mode: 'test', profile: 'full' } };
    return { provider, db, ctx, appOwned, readBackMatches, moneyCents };
  },
  tool: ({ provider, appOwned, readBackMatches, moneyCents }) => defineWrite({
    name: 'stripe_refund_contract_real_handler',
    read: async args => {
      expect(args.refundId).toBe('re_fixture_real_handler');
      return { refundableCents: moneyCents, appOwned };
    },
    summarize: async () => 'Refund the real-handler fixture. TEST MODE.',
    money: async (_args, _ctx, before) => ({
      amountCents: before.refundableCents, currency: 'usd', targetId:'ch_FAKE1234',direction: 'out',
      description: 'Refund verified customer balance'
    }),
    targetGuard: (args, _ctx, before) => !before.appOwned || args.outsideApp === true,
    apply: async (_args, _ctx, options) => { provider.writes.push(options); },
    readAfter: async () => { provider.afterCalls++;
      return { status: readBackMatches ? 'after' : 'before' }; },
    verify: async (_before, after) => after.status === 'after',
    inverse: async () => ({ tool: 'stripe_fixture_restore', args: { id: 'record' } })
  })
});

describe('owner gate and currency hardening', () => {
  it('releases a proven declined Stripe request but never automatically reuses its key', async () => {
    const Stripe = (await import('stripe')).default;
    const db = createFakeDb({ accounts:[{id:'acct_fixture',label:'Fixture',money_limit_cents:8500}] });
    let attempts = 0;
    const rejected = new Stripe.errors.StripeInvalidRequestError({
      type:'invalid_request_error', statusCode:400, message:'Invalid target', param:'charge'
    });
    const op = defineWrite({name:'stripe_test_refund', read:async()=>({cents:8500}),
      summarize:async()=> 'Refund fake balance. TEST MODE.',
      money:async(_a,_c,b)=>({amountCents:b.cents,currency:'usd',targetId:'ch_FAKE1234',direction:'out',
        description:'Verified fake refundable amount'}),
      apply:async()=>{attempts++;throw rejected;},
      readAfter:async()=>{throw new Error('Read after rejection should not happen');},
      verify:async()=>false });
    const ctx={ db, connectionId:'personal-fixture',       connection:{stripeAccount:'acct_fixture',mode:'test',profile:'full'} };
    const parse=r=>JSON.parse(r.content[0].text);
    const input={confirm:true,requestKey:'declined-once'};
    expect(parse(await op.handler(input,ctx)).error).toMatch(/explicit approval/);
    expect(await db.approveMoneyRequest({account:'acct_fixture',
      idempotencyKey:idempotencyKey(ctx.connection,op.tool.name,input)})).toBe(true);
    const res=parse(await op.handler(input,ctx));
    expect(res.done).toBe(false);
    expect(res.warning).toMatch(/definitively rejected/);
    expect((await db.getMoneyUsage({account:'acct_fixture',connection:'personal-fixture'})).used_cents).toBe(0);
    expect((await db.listAuditForTest()).at(-1).amount_cents).toBeNull();
    expect(parse(await op.handler({confirm:true,requestKey:'declined-once'},ctx)).done).toBe(false);
    expect(attempts).toBe(1);
  });
  it('keeps ambiguous network failures reserved until reconciliation', async () => {
    const db=createFakeDb({accounts:[{id:'acct_fixture',label:'Fixture',money_limit_cents:10000}]});
    const op=defineWrite({name:'stripe_test_payout',read:async()=>({cents:8500}),
      summarize:async()=> 'Payout fake balance. TEST MODE.',
      money:async(_a,_c,b)=>({amountCents:b.cents,currency:'usd',targetId:'ch_FAKE1234',direction:'out',description:'Payout'}),
      apply:async()=>{throw new Error('ECONNRESET');},readAfter:async()=>({}),verify:async()=>false});
    const ctx={db,connectionId:'owner',
      connection:{stripeAccount:'acct_fixture',mode:'test',profile:'full'}};
    const input={confirm:true,requestKey:'network-error'};
    expect(JSON.parse((await op.handler(input,ctx)).content[0].text).error).toMatch(/explicit approval/);
    expect(await db.approveMoneyRequest({account:'acct_fixture',
      idempotencyKey:idempotencyKey(ctx.connection,op.tool.name,input)})).toBe(true);
    const r=await op.handler(input,ctx);
    expect(JSON.parse(r.content[0].text).done).toBe(false);
    expect((await db.getMoneyUsage({account:'acct_fixture',connection:'owner'})).used_cents).toBe(8500);
  });

  it('formats integer USD cents but rejects fractional values', () => {
    expect(formatUsd(8500)).toBe('$85.00');
    expect(formatUsd(1)).toBe('$0.01');
    expect(() => formatUsd(0.5)).toThrow();
  });
  it('refuses money execution without owner-approved policy, despite confirm', async () => {
    const db = createFakeDb({ accounts:[{id:'acct_fixture', label:'Fixture'}] });
    let called = 0;
    const op = defineWrite({ name:'stripe_test_charge', read:async()=>({cents:10}),
      summarize:async()=> 'Test update', money:async(_args,_ctx,before)=>({
        amountCents:before.cents,currency:'usd',targetId:'ch_FAKE1234',direction:'out',description:'Provider balance'
      }), apply:async()=>{called++;}, readAfter:async()=>({updated:true}),verify:async()=>true });
    const res = await op.handler({confirm:true},{db,connectionId:'conn1',
      connection:{stripeAccount:'acct_fixture',mode:'test',profile:'full'}});
    expect(JSON.parse(res.content[0].text).done).toBe(false);
    expect(called).toBe(0);
  });
  it('refuses to format non-USD money out as if it were USD', async () => {
    const db = createFakeDb({ accounts:[{id:'acct_fixture',label:'Fixture'}] });
    const op = defineWrite({name:'stripe_test_eur',read:async()=>({ cents:900 }),
      summarize:async()=> 'Test update',money:async(_a,_c,b)=>({
        amountCents:b.cents,currency:'eur',targetId:'ch_FAKE1234',direction:'out',description:'EUR test'
      }),apply:async()=>{throw Error('MUST NOT APPLY');},readAfter:async()=>({}),verify:async()=>false});
    await expect(op.handler({confirm:true},{db,connectionId:'conn1',moneyPolicyApproved:true,
      connection:{stripeAccount:'acct_fixture',mode:'test',profile:'full'}})).rejects.toThrow(/Verified USD/);
  });
});
