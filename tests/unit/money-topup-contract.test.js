import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makeTopupWrite,tools,handlers} from '../../src/tools/money-topup-writes.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
const acct='acct_safefixture',topupId='tu_FAKE1234';
const parse=r=>JSON.parse(r.content[0].text);
function fixture({appOwned=false,readBackMatches=true,limitCents=10000}={}){
  const provider={writes:[],afterCalls:0};
  const db=createFakeDb({accounts:[{id:acct,label:'Fixture',money_limit_cents:limitCents}]});
  let current={object:'topup',id:topupId,livemode:false,status:'pending',
    amount:8500,currency:'usd',metadata:appOwned?{agreementId:'ag_FAKE'}:{}};
  let created=null;
  const sdk={
    accounts:{retrieve:async()=>({object:'account',id:acct,livemode:false,country:'US'})},
    topups:{
      async retrieve(id){
        if(provider.writes.length)provider.afterCalls++;
        if(id==='tu_NEW1234')return readBackMatches?created:{...created,amount:0};
        return {...current};
      },
      async create(p,opts){
        provider.writes.push({type:'create',payload:p,idempotencyKey:opts.idempotencyKey});
        created={id:'tu_NEW1234',object:'topup',amount:p.amount,
          currency:'usd',livemode:false,status:'pending',source:null};
        return {...created};
      },
      async cancel(_id,_p,opts){
        provider.writes.push({type:'cancel',key:opts.idempotencyKey});
        if(readBackMatches)current={...current,status:'canceled'};
        return {...current};
      }
    }
  };
  const ctx={db,connection:{stripeAccount:acct,mode:'test',profile:'full'},
    connectionId:'topup-fixture',services:{stripeForConnection:async()=>sdk}};
  return {db,provider,ctx,setTopup:p=>{current={...current,...p};}};
}
describe('G-1c4 owner-approved synthetic TEST top-up',()=>{
  runWriteContract({withMoney:true,strictArgs:true,createOnly:true,
    args:{amountCents:8500},
    tool:()=>makeTopupWrite('money_create_topup'),
    fixtures:fixture});
});
describe('G-1c4 pending TEST top-up cancellation',()=>{
  runWriteContract({withMoney:false,strictArgs:true,
    args:{topupId},tool:()=>makeTopupWrite('money_cancel_topup'),
    fixtures:fixture});
});
it('tool descriptions and profiles expose exactly guarded owner actions',()=>{
  expect(tools.map(x=>x.name)).toEqual(['money_create_topup','money_cancel_topup']);
  for(const t of tools){
    expect(t.writes).toBe(true);
    expect(t.profiles).toEqual(['full']);
    expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
  }
  expect(tools[0].safety).toBe('$');
});
it('AI confirm alone cannot debit even synthetic TEST bank; fixed token only',async()=>{
  const f=fixture();
  const res=parse(await handlers.money_create_topup({amountCents:8500,confirm:true},f.ctx));
  expect(res.error).toMatch(/explicit approval is required/);
  expect(f.provider.writes).toHaveLength(0);
  await expect(handlers.money_create_topup({amountCents:8500,
    source:'real-source',confirm:true},f.ctx)).rejects.toThrow();
});
it('cannot cancel succeeded top-up; cannot use LIVE connection',async()=>{
  const f=fixture();f.setTopup({status:'succeeded'});
  await expect(handlers.money_cancel_topup({topupId,confirm:true},f.ctx))
    .rejects.toThrow(/pending/);
  const live={...f.ctx,connection:{...f.ctx.connection,mode:'live'}};
  expect((await handlers.money_create_topup({amountCents:8500},live)).isError).toBe(true);
  expect(f.provider.writes).toHaveLength(0);
});
