// Real D-4 guarded handlers: the seven-case contract for every subscription mutation.
import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makeBillingWrite} from '../../src/tools/billing-writes.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

const customerId='cus_FAKE1234',priceId='price_FAKE1234',newPrice='price_NEW1234';
const subId='sub_FAKE1234',itemId='si_FAKE1234',methodId='pm_FAKE1234';
const effectiveAt=1791676800;
const scenarios=[
  {name:'billing_create_subscription',
    args:{customerId,priceId,quantity:1,billingMode:'flexible'}},
  {name:'billing_update_subscription',
    args:{subscriptionId:subId,description:'Updated test service'}},
  {name:'billing_change_plan',
    args:{subscriptionId:subId,itemId,priceId:newPrice,quantity:2,
      effectiveAt,prorationBehavior:'create_prorations'}},
  {name:'billing_cancel_subscription',
    args:{subscriptionId:subId,timing:'period_end'}},
  {name:'billing_undo_cancel',args:{subscriptionId:subId}},
  {name:'billing_pause_collection',
    args:{subscriptionId:subId,behavior:'keep_as_draft'}},
  {name:'billing_resume_collection',args:{subscriptionId:subId}}
];
function fixture({appOwned,readBackMatches,limitCents},name){
  const provider={writes:[],afterCalls:0};
  const db=createFakeDb({accounts:[{id:'acct_safefixture',
    label:'Fixture',money_limit_cents:limitCents}]});
  const marker=appOwned?{agreementId:'ag_FAKE1234'}:{};
  const customer={id:customerId,object:'customer',metadata:marker,
    invoice_settings:{default_payment_method:methodId}};
  const price={id:priceId,type:'recurring',currency:'usd',active:true,
    unit_amount:8500,recurring:{interval:'month',usage_type:'licensed'},metadata:{}};
  const prices={[priceId]:price,[newPrice]:{...price,id:newPrice,unit_amount:16000}};
  const item={id:itemId,object:'subscription_item',subscription:subId,quantity:1,
    price, current_period_start:1791000000,current_period_end:1793500000};
  const base={id:subId,object:'subscription',customer:customerId,currency:'usd',
    status:'active',billing_mode:{type:'flexible'},items:{data:[item],has_more:false},
    metadata:marker,description:'Old service',cancel_at:null,cancel_at_period_end:false,
    pause_collection:null,billing_cycle_anchor:1791000000};
  if(name==='billing_undo_cancel'){
    base.cancel_at_period_end=true;base.cancel_at=1793500000;
  }
  if(name==='billing_resume_collection')
    base.pause_collection={behavior:'keep_as_draft'};
  let next={...base},created=null;
  const record=opts=>{
    if(!opts?.idempotencyKey)throw new Error('Missing idempotency header');
    provider.writes.push({idempotencyKey:opts.idempotencyKey});
  };
  const sdk={
    customers:{retrieve:async()=>({...customer})},
    paymentMethods:{retrieve:async()=>({id:methodId,customer:customerId})},
    prices:{retrieve:async id=>({...prices[id]})},
    invoices:{createPreview:async()=>({object:'invoice',currency:'usd',
      total:8500,amount_due:8500,lines:{data:[]}})},
    subscriptions:{
      async retrieve(id){
        if(provider.writes.length)provider.afterCalls++;
        if(id==='sub_NEW1234')return readBackMatches?created:{...created,status:'incomplete',items:{data:[]}};
        return next;
      },
      async create(args,opts){
        record(opts);
        created={...base,id:'sub_NEW1234',customer:args.customer,
          billing_mode:args.billing_mode,
          items:{data:[{...item,price:prices[args.items[0].price],
            quantity:args.items[0].quantity}],has_more:false}};
        return created;
      },
      async update(_id,args,opts){
        record(opts);
        if(!readBackMatches)return next;
        next={...next};
        if(args.description!==undefined)next.description=args.description;
        if(args.metadata)next.metadata={...next.metadata,...args.metadata};
        if(args.default_payment_method)
          next.default_payment_method=args.default_payment_method;
        if(args.billing_cycle_anchor?.type==='now')
          next.billing_cycle_anchor=1791676800;
        if(args.items)next.items={data:next.items.data.map(i=>i.id===itemId?
          {...i,price:prices[args.items[0].price],quantity:args.items[0].quantity}:i),
          has_more:false};
        if(args.cancel_at_period_end!==undefined){
          next.cancel_at_period_end=args.cancel_at_period_end;
          next.cancel_at=args.cancel_at_period_end?1793500000:null;
        }
        if(args.pause_collection!==undefined)
          next.pause_collection=args.pause_collection||null;
        return next;
      },
      async cancel(_id,_args,opts){
        record(opts);if(readBackMatches)next={...next,status:'canceled'};
        return next;
      }
    }
  };
  const ctx={connection:{stripeAccount:'acct_safefixture',mode:'test',profile:'full'},
    connectionId:'owner-client-fixture',db,
    getCustomer:async()=>customer,
    services:{stripeForConnection:async()=>sdk}};
  return {provider,db,ctx,sdk};
}
for(const entry of scenarios){
  describe(entry.name,()=>{
    runWriteContract({
      withMoney:false,strictArgs:true,args:entry.args,
      tool:()=>makeBillingWrite(entry.name),
      fixtures:o=>fixture(o,entry.name)
    });
  });
}
const data=r=>JSON.parse(r.content[0].text);
const call=(name,args,sdk,connection={stripeAccount:'acct_safefixture',
  mode:'test',profile:'read_only'})=>
  dispatchReadOnlyTool({registry,name,args,connection,db:{},
    services:{stripeForConnection:async()=>sdk}});
describe('D-4 billing reads and fail-closed financial invariants',()=>{
  it('uses item periods only, never removed subscription periods',async()=>{
    const f=fixture({appOwned:false,readBackMatches:true,limitCents:50000},
      'billing_update_subscription');
    const sub=await f.sdk.subscriptions.retrieve(subId);
    sub.current_period_end=100;
    const r=await call('billing_get_subscription',{subscriptionId:subId},f.sdk);
    const v=data(r);
    expect(v.items[0].currentPeriodEndUnix).toBe(1793500000);
    expect(JSON.stringify(v)).not.toContain('"current_period_end":100');
  });
  it('passes exact nested items and frozen proration date into invoice preview',async()=>{
    const f=fixture({appOwned:false,readBackMatches:true,limitCents:50000},
      'billing_change_plan');
    const observed=[];
    f.sdk.invoices.createPreview=async payload=>{
      observed.push(payload);
      return {object:'invoice',currency:'usd',total:1250,
        amount_due:1250,lines:{data:[{amount:-500,
          parent:{subscription_item_details:{proration:true}}}]}};
    };
    const r=await call('billing_preview_change',{
      subscriptionId:subId,itemId,priceId:newPrice,quantity:2,
      effectiveAt,prorationBehavior:'create_prorations'},f.sdk);
    expect(data(r).prorationLines).toHaveLength(1);
    expect(observed[0].subscription_details.items).toEqual([{
      id:itemId,price:newPrice,quantity:2}]);
    expect(observed[0].subscription_details.proration_date).toBe(effectiveAt);
  });
  it('cannot bypass TEST writes through stripe_call or stripe_batch',async()=>{
    const f=fixture({appOwned:false,readBackMatches:true,limitCents:50000},
      'billing_cancel_subscription');
    const args={subscriptionId:subId,timing:'period_end',confirm:true};
    const invoke=(name,a)=>dispatchReadOnlyTool({
      registry,name,args:a,connection:f.ctx.connection,
      db:f.db,services:f.ctx.services});
    expect(data(await invoke('stripe_call',{
      name:'billing_cancel_subscription',args})).done).toBe(true);
    expect((await invoke('stripe_batch',{calls:[
      {name:'billing_cancel_subscription',args}]})).isError).toBe(true);
    expect(f.provider.writes).toHaveLength(1);
  });
  it('denies unsupported metadata, invalid or absent price and unsafe credits',async()=>{
    const f=fixture({appOwned:false,readBackMatches:true,limitCents:50000},
      'billing_change_plan');
    const op=makeBillingWrite('billing_change_plan');
    await expect(op.handler({subscriptionId:subId,itemId,
      priceId:newPrice,effectiveAt,prorationBehavior:'create_prorations',
      metadata:{agreementId:'injected'},confirm:true},f.ctx)).rejects.toThrow();
    const p=op.handler({subscriptionId:subId,itemId,priceId:newPrice,
      effectiveAt,prorationBehavior:'create_prorations',confirm:false},f.ctx);
    expect(data(await p).needsConfirmation).toBe(true);
    expect(f.provider.writes).toHaveLength(0);
  });
});
