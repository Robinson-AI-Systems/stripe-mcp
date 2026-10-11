// G-1c1 actual-handler contracts, app ownership and Stripe read-back tests.
import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makePayoutWrite,tools,handlers} from '../../src/tools/money-payout-writes.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
const payoutId='po_FAKE1234',parse=r=>JSON.parse(r.content[0].text);
function fixture({appOwned=false,readBackMatches=true,limitCents=10000}={}){
  const provider={writes:[],afterCalls:0};
  const db=createFakeDb({accounts:[{id:'acct_safefixture',
    label:'Fixture',money_limit_cents:limitCents}]});
  let current={id:payoutId,object:'payout',livemode:false,currency:'usd',amount:8500,
    automatic:false,status:'pending',metadata:appOwned?{agreementId:'ag_FAKE'}:{}};
  const sdk={payouts:{
    async retrieve(){
      if(provider.writes.length)provider.afterCalls++;
      return {...current,metadata:{...current.metadata}};
    },
    async update(_id,body,opts){
      provider.writes.push({idempotencyKey:opts?.idempotencyKey,body});
      if(readBackMatches)current={...current,metadata:{...current.metadata,...body.metadata}};
      return current;
    },
    async cancel(_id,_body,opts){
      provider.writes.push({idempotencyKey:opts?.idempotencyKey});
      if(readBackMatches)current={...current,status:'canceled'};
      return current;
    }
  }};
  const ctx={db,connection:{stripeAccount:'acct_safefixture',mode:'test',profile:'full'},
    connectionId:'payout-fixture',services:{stripeForConnection:async()=>sdk}};
  return {provider,db,ctx,sdk,setPayout:value=>{current={...current,...value};}};
}
describe('money_update_payout',()=>{
  runWriteContract({withMoney:false,strictArgs:true,
    args:{payoutId,metadata:{label:'test'}},
    tool:()=>makePayoutWrite('money_update_payout'),fixtures:fixture});
});
describe('money_cancel_payout',()=>{
  runWriteContract({withMoney:false,strictArgs:true,args:{payoutId},
    tool:()=>makePayoutWrite('money_cancel_payout'),fixtures:fixture});
});
it('both writes are full-profile only and uniquely registered',()=>{
  expect(tools.map(t=>t.name)).toEqual(['money_update_payout','money_cancel_payout']);
  for(const tool of tools){
    expect(tool.writes).toBe(true);
    expect(tool.profiles).toEqual(['full']);
    expect(registry.tools.filter(t=>t.name===tool.name)).toHaveLength(1);
  }
});
it('cannot cancel paid or automatic payouts even with AI confirm',async()=>{
  for(const values of [{status:'paid'},{automatic:true}]){
    const f=fixture();f.setPayout(values);
    const res=parse(await handlers.money_cancel_payout({
      payoutId,confirm:true},f.ctx));
    expect(res.done).toBe(false);
    expect(f.provider.writes).toHaveLength(0);
  }
});
it('blocks LIVE and refuses unverified payout or app-owned metadata',async()=>{
  const f=fixture();
  expect((await handlers.money_update_payout({payoutId,metadata:{ok:'yes'},
    confirm:true},{...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError)
    .toBe(true);
  await expect(handlers.money_update_payout({payoutId,
    metadata:{agreementId:'foreign'},confirm:true},f.ctx)).rejects.toThrow();
  f.setPayout({id:'po_OTHER1234'});
  await expect(handlers.money_cancel_payout({
    payoutId,confirm:true},f.ctx)).rejects.toThrow(/Verified/);
  expect(f.provider.writes).toHaveLength(0);
});
