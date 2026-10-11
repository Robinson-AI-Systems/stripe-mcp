// Real D-4b guarded item and subscription schedule handlers; fake TEST Stripe only.
import {describe,it,expect} from 'vitest';
import {runWriteContract} from '../helpers/write-contract.js';
import {makeBillingItemScheduleWrite} from '../../src/tools/billing-item-schedule-writes.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';

const cus='cus_FAKE1234',sub='sub_FAKE1234',price='price_FAKE1234';
const changed='price_NEW1234',si='si_FAKE1234',other='si_OTHER1234';
const schedule='sub_sched_FAKE1234',start=1893456000,at=1791676800;
const scenarios=[
  {name:'billing_add_item',args:{subscriptionId:sub,priceId:changed,quantity:2,
    effectiveAt:at,prorationBehavior:'create_prorations'}},
  {name:'billing_update_item',args:{subscriptionId:sub,itemId:si,
    priceId:changed,quantity:2,effectiveAt:at,prorationBehavior:'create_prorations'}},
  {name:'billing_remove_item',args:{subscriptionId:sub,itemId:si,
    effectiveAt:at,prorationBehavior:'create_prorations'}},
  {name:'billing_create_schedule',args:{customerId:cus,priceId:changed,
    quantity:2,startAt:start,iterations:6,endBehavior:'release',billingMode:'flexible'}},
  {name:'billing_update_schedule',args:{scheduleId:schedule,priceId:changed,
    quantity:2,iterations:6,endBehavior:'cancel'}},
  {name:'billing_release_schedule',args:{scheduleId:schedule}},
  {name:'billing_cancel_schedule',args:{scheduleId:schedule,
    invoiceNow:false,prorate:false}}
];
const makePrice=(id,amount)=>({id,object:'price',active:true,currency:'usd',
  type:'recurring',unit_amount:amount,recurring:{interval:'month',usage_type:'licensed'},
  metadata:{}});
const prices={[price]:makePrice(price,8500),[changed]:makePrice(changed,16000)};
const plain=(r)=>JSON.parse(r.content[0].text);
function fixture({appOwned=false,readBackMatches=true,credit=false,limitCents=10000},name){
  const marker=appOwned?{agreementId:'ag_FAKE1234'}:{};
  const provider={writes:[],afterCalls:0,previews:[],payloads:[]};
  const db=createFakeDb({accounts:[{id:'acct_safefixture',
    label:'Fixture',money_limit_cents:limitCents}]});
  const customer={id:cus,object:'customer',metadata:marker};
  const item=(id,priceId,quantity=1)=>({id,object:'subscription_item',
    subscription:sub,price:prices[priceId],quantity,
    current_period_start:1791000000,current_period_end:1793500000});
  let base={id:sub,object:'subscription',customer:cus,currency:'usd',status:'active',
    metadata:marker,billing_mode:{type:'flexible'},
    items:{data:[item(si,price),item(other,price)],has_more:false}};
  let plan={id:schedule,object:'subscription_schedule',customer:cus,
    status:name==='billing_release_schedule'?'active':'not_started',
    subscription:sub,start_date:start,end_behavior:'release',
    billing_mode:{type:'flexible'},metadata:marker,
    phases:[{start_date:start,iterations:3,items:[{price,quantity:1}]}]};
  let created=null,createdItem=null;
  const record=(kind,args,opts)=>{
    if(!opts?.idempotencyKey)throw Error('Missing provider idempotency');
    provider.writes.push({idempotencyKey:opts.idempotencyKey,kind});
    provider.payloads.push(args);
  };
  const sdk={
    customers:{retrieve:async()=>({...customer})},
    prices:{retrieve:async id=>({...prices[id]})},
    invoices:{createPreview:async payload=>{
      provider.previews.push(payload);
      return {object:'invoice',currency:'usd',total:credit?0:8500,amount_due:credit?0:8500,
        lines:{data:credit?[{amount:-8500,
          parent:{subscription_item_details:{proration:true}}}]:[]}};
    }},
    subscriptions:{retrieve:async()=>{if(provider.writes.length)provider.afterCalls++;return base;}},
    subscriptionItems:{
      async create(args,opts){
        record('add',args,opts);
        createdItem=item('si_NEW1234',args.price,args.quantity);
        if(readBackMatches)base={...base,items:{...base.items,
          data:[...base.items.data,createdItem]}};
        return createdItem;
      },
      async update(id,args,opts){
        record('update',args,opts);
        if(readBackMatches)base={...base,items:{...base.items,
          data:base.items.data.map(x=>x.id===id?item(id,args.price,args.quantity):x)}};
        return base.items.data.find(x=>x.id===id);
      },
      async del(id,args,opts){
        record('remove',args,opts);
        if(readBackMatches)base={...base,items:{...base.items,
          data:base.items.data.filter(x=>x.id!==id)}};
        return {id,object:'subscription_item',deleted:true};
      },
      async retrieve(id){
        if(provider.writes.length)provider.afterCalls++;
        if(id==='si_NEW1234'&&!readBackMatches)return {...createdItem,quantity:999};
        return base.items.data.find(x=>x.id===id)??null;
      }
    },
    subscriptionSchedules:{
      async retrieve(id){
        if(provider.writes.length)provider.afterCalls++;
        if(id==='sub_sched_NEW1234')return readBackMatches?created:
          {...created,status:'canceled'};
        return plan;
      },
      async create(args,opts){
        record('createSchedule',args,opts);
        created={...plan,id:'sub_sched_NEW1234',status:'not_started',
          start_date:args.start_date,billing_mode:args.billing_mode,
          customer:args.customer,end_behavior:args.end_behavior,phases:args.phases};
        return created;
      },
      async update(id,args,opts){
        record('updateSchedule',args,opts);
        if(readBackMatches)plan={...plan,phases:args.phases,
          end_behavior:args.end_behavior};
        return plan;
      },
      async release(id,args,opts){
        record('release',args,opts);
        if(readBackMatches)plan={...plan,status:'released'};
        return plan;
      },
      async cancel(id,args,opts){
        record('cancel',args,opts);
        if(readBackMatches)plan={...plan,status:'canceled'};
        return plan;
      }
    }
  };
  const ctx={connection:{stripeAccount:'acct_safefixture',mode:'test',profile:'full'},
    connectionId:'owner-client-fixture',db,getCustomer:async()=>customer,
    services:{stripeForConnection:async()=>sdk}};
  return {ctx,db,sdk,provider};
}
for(const {name,args} of scenarios){
  describe('D-4b '+name,()=>{
    runWriteContract({withMoney:false,strictArgs:true,args,
      tool:()=>makeBillingItemScheduleWrite(name),
      fixtures:opts=>fixture(opts,name)});
  });
}
describe('D-4b provider-confirmed negative item proration owner consent',()=>{
  runWriteContract({withMoney:true,strictArgs:true,
    args:scenarios.find(x=>x.name==='billing_update_item').args,
    tool:()=>makeBillingItemScheduleWrite('billing_update_item'),
    fixtures:opts=>fixture({...opts,credit:true},'billing_update_item')});
});
it('item preview lists every subscription item; update persists only target',async()=>{
  const f=fixture({readBackMatches:true},'billing_update_item');
  const args=scenarios.find(x=>x.name==='billing_update_item').args;
  const res=plain(await makeBillingItemScheduleWrite('billing_update_item')
    .handler({...args,confirm:true},f.ctx));
  expect(res.done).toBe(true);
  const preview=f.provider.previews[0].subscription_details;
  expect(preview.items).toHaveLength(2);
  expect(preview.items.some(x=>x.id===other&&x.quantity===1)).toBe(true);
  expect(preview.items.some(x=>x.id===si&&x.price===changed&&x.quantity===2)).toBe(true);
  expect(f.provider.payloads[0].price).toBe(changed);
});
it('removal cannot delete the final subscription item',async()=>{
  const f=fixture({readBackMatches:true},'billing_remove_item');
  const op=makeBillingItemScheduleWrite('billing_remove_item');
  f.sdk.subscriptions.retrieve=async()=>({id:sub,customer:cus,currency:'usd',
    status:'active',metadata:{},items:{data:[{
      id:si,price:prices[price],quantity:1,
      current_period_start:1791000000,current_period_end:1793500000
    }],has_more:false}});
  await expect(op.handler({...scenarios[2].args,confirm:true},f.ctx))
    .rejects.toThrow(/final item/);
  expect(f.provider.writes).toHaveLength(0);
});
it('non-prorated future item change rejected, with no provider write',async()=>{
  const f=fixture({readBackMatches:true},'billing_add_item');
  const args={...scenarios[0].args,prorationBehavior:'none',effectiveAt:start};
  await expect(makeBillingItemScheduleWrite('billing_add_item')
    .handler({...args,confirm:true},f.ctx)).rejects.toThrow(/apply now/);
  expect(f.provider.writes).toHaveLength(0);
});
it('future schedule dry run exposes the exact configured start and quantity',async()=>{
  const f=fixture({readBackMatches:true},'billing_create_schedule');
  const res=plain(await makeBillingItemScheduleWrite('billing_create_schedule')
    .handler({...scenarios[3].args,dryRun:true},f.ctx));
  expect(res.preview).toContain(String(start));
  expect(f.provider.previews[0].schedule_details.phases[0].items[0])
    .toEqual({price:changed,quantity:2});
  expect(f.provider.writes).toHaveLength(0);
});
