import {describe,it,expect,vi} from 'vitest';
import {tools,handlers} from '../../src/tools/admin-fees.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='acct_FEETEST',start=1790000000,end=start+86400;
const parse=v=>JSON.parse(v.content[0].text);
const row=(suffix,amount,fee,currency='usd',details=[{type:'stripe_fee',amount:fee,currency}])=>({
  object:'balance_transaction',id:'txn_'+suffix,created:start+60,
  currency,amount,fee,net:amount-fee,reporting_category:'charge',
  fee_details:details,description:'PRIVATE_INVOICE_PERSONAL'});
function fixture({pages,refused=false,foreign=false}={}){
  const queue=pages??[{object:'list',has_more:false,
    data:[row('A123',1000,59),row('B123',-200,0,'usd',[])]}];
  const sdk={accounts:{retrieve:vi.fn(async()=>({
    object:'account',id:foreign?'acct_OTHER':id,livemode:false}))},
    balanceTransactions:{list:vi.fn(async()=>{
      if(refused)throw {statusCode:403,code:'permission_denied'};
      return queue.shift();
    })}};
  const ctx={connection:{mode:'test',stripeAccount:id,profile:'read_only'},
    services:{stripeForConnection:async()=>sdk}};
  return {ctx,sdk};
}
describe('G-6d bounded TEST fees and billing',()=>{
  it('registers one read-only tool and reconciles fee breakdown in USD minor units',async()=>{
    expect(tools).toHaveLength(1);
    expect(tools[0].writes).toBe(false);
    expect(registry.tools.filter(t=>t.name==='admin_fees_and_billing')).toHaveLength(1);
    const f=fixture(),out=parse(await handlers.admin_fees_and_billing({from:start,to:end},f.ctx));
    expect(out).toMatchObject({complete:true,available:true,transactionsScanned:2,
      sampleTotals:[{currency:'usd',grossMinor:800,feeMinor:59,netMinor:741,transactions:2}],
      statementsVerified:false,billingFeesStatus:'not_readable'});
    expect(out.byFeeType).toEqual([{currency:'usd',types:[{type:'stripe_fee',feeMinor:59}]}]);
    expect(out.byCategory).toEqual([{currency:'usd',categories:[{
      category:'charge',grossMinor:800,feeMinor:59,netMinor:741,transactions:2}]}]);
    expect(JSON.stringify(out)).not.toContain('PRIVATE_INVOICE_PERSONAL');
    expect(f.sdk.balanceTransactions.list).toHaveBeenCalledWith({
      limit:50,created:{gte:start,lt:end}});
  });
  it('preserves page and currency boundaries and labels capped ledger partial',async()=>{
    const f=fixture({pages:[
      {object:'list',has_more:true,data:[row('AAAA',1000,40)]},
      {object:'list',has_more:true,data:[row('BBBB',1000,50,'eur',
        [{type:'stripe_fee',amount:50,currency:'eur'}])]}]});
    const v=parse(await handlers.admin_fees_and_billing({
      from:start,to:end,pageLimit:1,maxPages:2},f.ctx));
    expect(v.complete).toBe(false);
    expect(v.transactionsScanned).toBe(2);
    expect(v.sampleTotals.map(x=>x.currency)).toEqual(['eur','usd']);
    expect(v.sampleTotals).toEqual([
      {currency:'eur',grossMinor:1000,feeMinor:50,netMinor:950,transactions:1},
      {currency:'usd',grossMinor:1000,feeMinor:40,netMinor:960,transactions:1}
    ]);
    expect(v.byCategory).toHaveLength(2);
    expect(v.byCategory.every(x=>x.categories[0].category==='charge')).toBe(true);
    expect(v.note).toMatch(/PARTIAL/);
    expect(f.sdk.balanceTransactions.list.mock.calls[1][0].starting_after).toBe('txn_AAAA');
  });
  it('returns unreadable for permission refusal, never a zero fee total',async()=>{
    const v=parse(await handlers.admin_fees_and_billing({from:start,to:end},
      fixture({refused:true}).ctx));
    expect(v).toMatchObject({available:false,complete:false,sampleTotals:null});
  });
  it('fails closed on mismatched fees, duplicate pages, foreign account and LIVE',async()=>{
    const f=fixture({pages:[{object:'list',has_more:false,
      data:[row('A123',1000,59,'usd',[{type:'stripe_fee',amount:50,currency:'usd'}])]}]});
    expect((await handlers.admin_fees_and_billing({from:start,to:end},f.ctx)).isError)
      .toBe(true);
    expect((await handlers.admin_fees_and_billing({from:start,to:end},
      fixture({foreign:true}).ctx)).isError).toBe(true);
    expect((await handlers.admin_fees_and_billing({from:start,to:end},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    for(const args of [{from:start,to:start},{from:start,to:end+32*86400},
      {from:start,to:end,pageLimit:101},{from:start,to:end,unknown:1}])
      expect((await handlers.admin_fees_and_billing(args,f.ctx)).isError).toBe(true);
  });
  it('passes the indirect read-only dispatch gate',async()=>{
    const f=fixture(),out=await dispatchReadOnlyTool({registry,
      name:'admin_fees_and_billing',args:{from:start,to:end},
      connection:f.ctx.connection,services:f.ctx.services,db:{}});
    expect(out.isError).toBeUndefined();
    expect(JSON.stringify(out)).not.toContain('PRIVATE_INVOICE_PERSONAL');
  });
});
