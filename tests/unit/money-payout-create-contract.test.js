import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makePayoutCreateWrite,handlers,tools}
  from '../../src/tools/money-payout-create.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
const acct='acct_safefixture',bank='ba_FAKE1234';
const args={amountCents:8500,destinationId:bank,sourceType:'card'};
const parse=r=>JSON.parse(r.content[0].text);
function fixture({readBackMatches=true,limitCents=10000}={}){
  const db=createFakeDb({accounts:[{id:acct,label:'Fixture',money_limit_cents:limitCents}]});
  const provider={writes:[],afterCalls:0};
  let dest={object:'bank_account',id:bank,account:acct,currency:'usd',
    country:'US',status:'verified',last4:'1234'};
  let own={object:'account',id:acct,livemode:false,country:'US'};
  let balance={object:'balance',livemode:false,available:[
    {currency:'usd',amount:20000,source_types:{card:20000}}]};
  let created=null;
  const s={
    accounts:{retrieve:async()=>own,retrieveExternalAccount:async()=>dest},
    balance:{retrieve:async()=>balance},
    payouts:{
      async create(payload,opts){
        provider.writes.push({payload,idempotencyKey:opts.idempotencyKey});
        created={id:'po_NEW1234',object:'payout',automatic:false,livemode:false,
          status:'pending',amount:payload.amount,currency:payload.currency,
          method:payload.method,source_type:payload.source_type,
          destination:payload.destination};
        return created;
      },
      async retrieve(){
        provider.afterCalls++;
        return readBackMatches?created:{...created,amount:0};
      }
    }
  };
  const ctx={db,connection:{stripeAccount:acct,mode:'test',profile:'full'},
    connectionId:'payout-create-test',services:{stripeForConnection:async()=>s}};
  return {db,provider,ctx,setBank:x=>{dest={...dest,...x};},
    setOwn:x=>{own={...own,...x};},setBalance:x=>{balance=x;}};
}
describe('G-1c2 owner-approved payout actual-handler write contract',()=>{
  runWriteContract({withMoney:true,createOnly:true,strictArgs:true,
    args,fixtures:fixture,tool:makePayoutCreateWrite});
});
it('registers a full-only money-out write through the standard contract',()=>{
  expect(tools).toHaveLength(1);
  expect(tools[0]).toMatchObject({name:'money_create_payout',safety:'$',
    writes:true,profiles:['full']});
  expect(registry.tools.filter(x=>x.name==='money_create_payout')).toHaveLength(1);
});
it('refuses confirm-only without independent owner grant',async()=>{
  const f=fixture();
  const result=parse(await handlers.money_create_payout({...args,confirm:true},f.ctx));
  expect(result.done).toBe(false);
  expect(result.error).toMatch(/explicit approval is required/);
  expect(f.provider.writes).toHaveLength(0);
});
it('rejects account identity, unverified bank and insufficient source funds',async()=>{
  for(const kind of ['account','bank','funds']){
    const f=fixture();
    if(kind==='account')f.setOwn({id:'acct_OTHER'});
    if(kind==='bank')f.setBank({status:'new'});
    if(kind==='funds')f.setBalance({object:'balance',livemode:false,
      available:[{currency:'usd',amount:20000,source_types:{card:100}}]});
    await expect(handlers.money_create_payout({...args,confirm:true},f.ctx))
      .rejects.toThrow();
    expect(f.provider.writes).toHaveLength(0);
  }
});
it('refuses LIVE and raw bank data in arguments',async()=>{
  const f=fixture();
  expect((await handlers.money_create_payout(args,{
    ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
  await expect(handlers.money_create_payout({...args,confirm:true,
    routingNumber:'000000000'},f.ctx)).rejects.toThrow();
  expect(f.provider.writes).toHaveLength(0);
});
