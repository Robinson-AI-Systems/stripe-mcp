import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makePayoutReverseWrite,tools,handlers}
  from '../../src/tools/money-payout-reverse.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
const acct='acct_safefixture',payout='po_FAKE1234',bank='ba_FAKE1234';
const parse=r=>JSON.parse(r.content[0].text);
function fixture({appOwned=false,readBackMatches=true,limitCents=10000}={}){
  const db=createFakeDb({accounts:[{id:acct,label:'Fixture',money_limit_cents:limitCents}]});
  const provider={writes:[],afterCalls:0};
  let old={id:payout,object:'payout',livemode:false,currency:'usd',amount:8500,
    status:'paid',automatic:false,destination:bank,reversed_by:null,
    original_payout:null,metadata:appOwned?{agreementId:'ag_FAKE'}:{}};
  let bankStatus={id:bank,object:'bank_account',account:acct,country:'US',last4:'4567'};
  let reversal=null;
  const s={
    accounts:{retrieve:async()=>({id:acct,object:'account',livemode:false,country:'US'}),
      retrieveExternalAccount:async()=>bankStatus},
    payouts:{
      async retrieve(id){
        if(id==='po_REVERSE1234'){
          provider.afterCalls++;
          return readBackMatches?reversal:{...reversal,amount:0};
        }
        return {...old};
      },
      async reverse(id,_params,opts){
        provider.writes.push({id,idempotencyKey:opts.idempotencyKey});
        reversal={id:'po_REVERSE1234',object:'payout',livemode:false,
          original_payout:payout,destination:bank,currency:'usd',amount:-8500};
        if(readBackMatches)old={...old,reversed_by:reversal.id};
        return {...reversal};
      }
    }
  };
  const ctx={db,connection:{stripeAccount:acct,mode:'test',profile:'full'},
    connectionId:'reverse-fixture',services:{stripeForConnection:async()=>s}};
  return {db,provider,ctx,setOriginal:x=>{old={...old,...x};},
    setBank:x=>{bankStatus={...bankStatus,...x};}};
}
describe('G-1c3 bank debit money-out actual-handler contract',()=>{
  runWriteContract({withMoney:true,strictArgs:true,args:{payoutId:payout},
    tool:makePayoutReverseWrite,fixtures:fixture});
});
it('registers exactly one full-profile guarded money-out reversal',()=>{
  expect(tools).toHaveLength(1);
  expect(tools[0]).toMatchObject({name:'money_reverse_payout',
    writes:true,safety:'$',profiles:['full']});
  expect(registry.tools.filter(x=>x.name==='money_reverse_payout')).toHaveLength(1);
});
it('AI confirm never provides independent bank-debit owner consent',async()=>{
  const f=fixture();
  const result=parse(await handlers.money_reverse_payout({
    payoutId:payout,confirm:true},f.ctx));
  expect(result.done).toBe(false);
  expect(result.error).toMatch(/explicit approval is required/);
  expect(f.provider.writes).toHaveLength(0);
});
it('refuses pending, automatic, already reversed or foreign bank payout',async()=>{
  for(const x of [{status:'pending'},{automatic:true},
    {reversed_by:'po_PREV1234'},{destination:'ba_OTHER1234'}]){
    const f=fixture();f.setOriginal(x);
    await expect(handlers.money_reverse_payout({
      payoutId:payout,confirm:true},f.ctx)).rejects.toThrow();
    expect(f.provider.writes).toHaveLength(0);
  }
});
it('refuses non-US bank and LIVE before provider debit',async()=>{
  const f=fixture();f.setBank({country:'CA'});
  await expect(handlers.money_reverse_payout({payoutId:payout},f.ctx))
    .rejects.toThrow();
  const live=fixture();
  expect((await handlers.money_reverse_payout({payoutId:payout},
    {...live.ctx,connection:{...live.ctx.connection,mode:'live'}})).isError)
    .toBe(true);
  expect(f.provider.writes).toHaveLength(0);
  expect(live.provider.writes).toHaveLength(0);
});
