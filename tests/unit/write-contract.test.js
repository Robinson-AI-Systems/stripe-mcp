import { describe, expect, it } from 'vitest';
import { runWriteContract } from '../helpers/write-contract.js';
import { defineWrite } from '../../src/tools/write.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';
import { formatUsd } from '../../src/money.js';
runWriteContract({withMoney:false});
runWriteContract({withMoney:true});
describe('owner gate and currency hardening', () => {
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
        amountCents:before.cents,currency:'usd',direction:'out',description:'Provider balance'
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
        amountCents:b.cents,currency:'eur',direction:'out',description:'EUR test'
      }),apply:async()=>{throw Error('MUST NOT APPLY');},readAfter:async()=>({}),verify:async()=>false});
    await expect(op.handler({confirm:true},{db,connectionId:'conn1',moneyPolicyApproved:true,
      connection:{stripeAccount:'acct_fixture',mode:'test',profile:'full'}})).rejects.toThrow(/Verified USD/);
  });
});
