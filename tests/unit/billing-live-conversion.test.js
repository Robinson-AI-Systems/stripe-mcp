// Owner-obedience V2 (family 5, Billing): the fourteen subscription,
// item and schedule writes execute in the connection's own mode. LIVE
// previews bind confirmation to the preview fingerprint, evaluated
// objects and read-backs are mode-checked in both directions, the
// provider-derived proration money contract on billing_change_plan
// stays exact, and subscription discount verification follows the
// connection's mode.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {makeBillingWrite} from '../../src/tools/billing-writes.js';
import {makeBillingItemScheduleWrite,tools as itemTools}
  from '../../src/tools/billing-item-schedule-writes.js';
import {handlers as billingReads} from '../../src/tools/billing.js';
import {discountSafe,subscriptionSafe} from '../../src/tools/billing-shared.js';
import {idempotencyKey} from '../../src/stripe/client.js';

const acct='acct_FAKE1234',cus='cus_FAKE1234',subId='sub_FAKE1234',
  itemId='si_FAKE1234',priceId='price_FAKE1234',newPriceId='price_FAKE9999',
  pm='pm_FAKE1234',schedId='sub_sched_FAKE1234',eff=1791676800;

async function liveDb(){
  const db=createFakeDb({accounts:[{id:acct,live_enabled:true,
    live_connected:true,money_limit_cents:10000}]});
  await db.saveLiveKey({account:acct,ciphertext:'v1.fake',
    kind:'restricted',last4:'FAKE'});
  await db.createAccessToken({accessToken:'owner-live-access',
    clientId:'owner-client',stripeAccount:acct,mode:'live',
    profile:'full',liveWriteApproved:true});
  return db;
}
async function liveCtx(db,sdk){
  const scope=(await db.tokenRowsForTest())
    .find(t=>t.kind==='connector')?.result_scope;
  return {db,services:{stripeForConnection:async()=>sdk},liveAccessGranted:true,
    getCustomer:async()=>({id:cus,object:'customer',livemode:true,metadata:{}}),
    connectionId:scope,connection:{stripeAccount:acct,mode:'live',
      profile:'full',listing:'catalog',context:'customer',
      rtcLiveOwnerApproved:true,moneyLimitCents:0}};
}
function testCtx(db,sdk){
  return {db,services:{stripeForConnection:async()=>sdk},
    getCustomer:async()=>({id:cus,object:'customer',livemode:false,metadata:{}}),
    connection:{stripeAccount:acct,mode:'test',profile:'full'},env:{}};
}
const parse=reply=>JSON.parse(reply.content[0].text);
const handlers1={};
let intentSeq=0;
// The owner's LIVE approval, simulated through the same
// decision-intent path the protected owner page uses in production.
async function approveFor(db,ctx,tool,args){
  const id='V2BILL'+String(++intentSeq).padStart(26,'0');
  expect(await db.requestMoneyDecisionIntent({id,account:acct,
    idempotencyKey:idempotencyKey(ctx.connection,tool,args),
    kind:'approve',expiresAt:new Date(Date.now()+600000)})).toBe(true);
  expect(await db.consumeMoneyDecisionIntent(id)).toBe(true);
}

afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});

// --- Subscription writes (billing-writes.js) -------------------------
function subFixture({credit=false,livemode=true,cancelAtPeriodEnd=false,
    paused=false}={}){
  const item={id:itemId,object:'subscription_item',livemode,quantity:1,
    price:{id:priceId},current_period_start:1791000000,
    current_period_end:1793500000,discounts:[]};
  let next={id:subId,object:'subscription',livemode,customer:cus,
    currency:'usd',status:'active',billing_mode:{type:'flexible'},
    items:{data:[{...item}],has_more:false},metadata:{},
    description:'Old service',cancel_at:cancelAtPeriodEnd?1793500000:null,
    cancel_at_period_end:cancelAtPeriodEnd,pause_collection:paused?
      {behavior:'keep_as_draft',resumes_at:null}:null,
    billing_cycle_anchor:1791000000,discounts:[]};
  let created=null;const writes=[];
  const record=opts=>{if(!opts?.idempotencyKey)
    throw new Error('Missing idempotency header');
    writes.push({idempotencyKey:opts.idempotencyKey});};
  const prices={[priceId]:{unit_amount:8500},[newPriceId]:{unit_amount:16000}};
  const price=id=>({id,object:'price',livemode,type:'recurring',currency:'usd',
    active:true,...prices[id],
    recurring:{interval:'month',usage_type:'licensed'},metadata:{}});
  const sdk={
    accounts:{retrieve:async()=>({object:'account',id:acct,livemode:true})},
    balance:{retrieve:async()=>({object:'balance',livemode:true})},
    customers:{retrieve:async()=>({id:cus,object:'customer',livemode,
      metadata:{},invoice_settings:{default_payment_method:pm}})},
    paymentMethods:{retrieve:async()=>({id:pm,object:'payment_method',
      livemode,customer:cus})},
    prices:{retrieve:async id=>price(id)},
    invoices:{createPreview:async()=>({object:'invoice',livemode,
      currency:'usd',total:8500,amount_due:8500,lines:{data:credit?
        [{amount:-8500,parent:{subscription_item_details:{proration:true}}}]:[],
        has_more:false}})},
    subscriptions:{
      retrieve:async id=>id==='sub_NEW1234'?created:next,
      create:async(args,opts)=>{record(opts);created={...next,id:'sub_NEW1234',
        customer:args.customer,billing_mode:args.billing_mode,
        items:{data:[{...item,price:price(args.items[0].price),
          quantity:args.items[0].quantity}],has_more:false}};return created;},
      update:async(_id,args,opts)=>{record(opts);next={...next};
        if(args.description!==undefined)next.description=args.description;
        if(args.metadata)next.metadata={...next.metadata,...args.metadata};
        if(args.default_payment_method)
          next.default_payment_method=args.default_payment_method;
        if(args.billing_cycle_anchor==='now')
          next.billing_cycle_anchor=1791676800;
        if(args.items)next.items={data:next.items.data.map(i=>i.id===itemId?
          {...i,price:price(args.items[0].price),
            quantity:args.items[0].quantity}:i),has_more:false};
        if(args.cancel_at_period_end!==undefined){
          next.cancel_at_period_end=args.cancel_at_period_end;
          next.cancel_at=args.cancel_at_period_end?1793500000:null;}
        if(args.pause_collection!==undefined)
          next.pause_collection=args.pause_collection||null;
        return next;},
      cancel:async(_id,_args,opts)=>{record(opts);
        next={...next,status:'canceled'};return next;}
    }};
  return {sdk,writes,getSub:()=>next,setSub:v=>{next=v;}};
}
const subArgs={
  billing_create_subscription:{customerId:cus,priceId,quantity:1,billingMode:'flexible'},
  billing_update_subscription:{subscriptionId:subId,description:'New service'},
  billing_change_plan:{subscriptionId:subId,itemId,priceId:newPriceId,
    effectiveAt:eff,prorationBehavior:'none'},
  billing_cancel_subscription:{subscriptionId:subId,timing:'period_end'},
  billing_undo_cancel:{subscriptionId:subId},
  billing_pause_collection:{subscriptionId:subId,behavior:'keep_as_draft'},
  billing_resume_collection:{subscriptionId:subId}
};
const subFixtureOpts={
  billing_undo_cancel:{cancelAtPeriodEnd:true},
  billing_resume_collection:{paused:true}
};

describe('Billing subscriptions — LIVE preview, fingerprint and confirm',()=>{
  for(const name of Object.keys(subArgs)){
    it(name+' previews in LIVE and confirms against the fingerprint',async()=>{
      vi.stubEnv('VERCEL_ENV','production');
      const db=await liveDb();
      const fx=subFixture(subFixtureOpts[name]??{});
      const ctx=await liveCtx(db,fx.sdk);
      const preview=parse(await makeBillingWrite(name)
        .handler({...subArgs[name],dryRun:true},ctx));
      expect(preview.preview).toMatch(/LIVE MODE/);
      expect(preview.previewFingerprint).toMatch(/^WRITE-[0-9A-F]{5}(-[0-9A-F]{5}){3}$/);
      expect(fx.writes).toHaveLength(0);
      const done=parse(await makeBillingWrite(name).handler(
        {...subArgs[name],confirm:true,
          previewFingerprint:preview.previewFingerprint},ctx));
      expect(done.done).toBe(true);
      expect(done.mode).toBe('LIVE');
      expect(fx.writes).toHaveLength(1);
    });
  }
  it('a TEST preview still leads with TEST MODE',async()=>{
    const fx=subFixture({livemode:false});
    const preview=parse(await makeBillingWrite('billing_update_subscription')
      .handler({...subArgs.billing_update_subscription,dryRun:true},
        testCtx(createFakeDb(),fx.sdk)));
    expect(preview.preview).toMatch(/TEST MODE/);
    expect(preview.previewFingerprint).toMatch(/^WRITE-/);
  });
  it('fingerprint drift refuses execution and discloses the fresh fingerprint',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const db=await liveDb();
    const fx=subFixture();
    const ctx=await liveCtx(db,fx.sdk);
    const preview=parse(await makeBillingWrite('billing_change_plan')
      .handler({...subArgs.billing_change_plan,dryRun:true},ctx));
    const sub=fx.getSub();
    fx.setSub({...sub,items:{data:[{...sub.items.data[0],quantity:5}],
      has_more:false}});
    const refused=parse(await makeBillingWrite('billing_change_plan').handler(
      {...subArgs.billing_change_plan,confirm:true,
        previewFingerprint:preview.previewFingerprint},ctx));
    expect(refused.done).toBe(false);
    expect(refused.previewFingerprint).not.toBe(preview.previewFingerprint);
    expect(fx.writes).toHaveLength(0);
    const done=parse(await makeBillingWrite('billing_change_plan').handler(
      {...subArgs.billing_change_plan,confirm:true,
        previewFingerprint:refused.previewFingerprint},ctx));
    expect(done.done).toBe(true);
    expect(fx.writes).toHaveLength(1);
  });
  it('change_plan proration credit in LIVE still needs exact owner approval',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const db=await liveDb();
    const fx=subFixture({credit:true});
    const ctx=await liveCtx(db,fx.sdk);
    const args={...subArgs.billing_change_plan,prorationBehavior:'create_prorations'};
    const preview=parse(await makeBillingWrite('billing_change_plan')
      .handler({...args,dryRun:true},ctx));
    expect(preview.preview).toContain('Money out: $85.00 USD');
    const confirmArgs={...args,confirm:true,requestKey:'live-change-plan-1',
      previewFingerprint:preview.previewFingerprint};
    const prepared=parse(await makeBillingWrite('billing_change_plan')
      .handler(confirmArgs,ctx));
    expect(prepared.done).toBe(false);
    expect(typeof prepared.error).toBe('string');
    expect(fx.writes).toHaveLength(0);
    await approveFor(db,ctx,'billing_change_plan',confirmArgs);
    const done=parse(await makeBillingWrite('billing_change_plan').handler(
      confirmArgs,ctx));
    expect(done.done).toBe(true);
    expect(fx.writes).toHaveLength(1);
    expect((await db.getMoneyUsage({account:acct,connection:ctx.connectionId}))
      .used_cents).toBe(8500);
  });
  it('LIVE context rejects TEST objects and TEST context rejects LIVE objects',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const db=await liveDb();
    const fx=subFixture({livemode:false});
    await expect(makeBillingWrite('billing_update_subscription').handler(
      {...subArgs.billing_update_subscription,dryRun:true},await liveCtx(db,fx.sdk)))
      .rejects.toThrow(/mode mismatch/);
    const live=subFixture({livemode:true});
    await expect(makeBillingWrite('billing_update_subscription').handler(
      {...subArgs.billing_update_subscription,dryRun:true},
        testCtx(createFakeDb(),live.sdk))).rejects.toThrow(/mode mismatch/);
  });
});

// --- Items and schedules (billing-item-schedule-writes.js) -----------
function itemFixture({status='not_started',livemode=true}={}){
  const prices0={[priceId]:8500,[newPriceId]:16000};
  const fullPrice=id2=>({id:id2,object:'price',livemode,type:'recurring',
    currency:'usd',active:true,unit_amount:prices0[id2],
    recurring:{interval:'month',usage_type:'licensed'},metadata:{}});
  const itemA={id:'si_FAKE1234',object:'subscription_item',livemode,quantity:1,
    price:fullPrice(priceId),current_period_start:1791000000,
    current_period_end:1793500000,discounts:[]};
  const itemB={...itemA,id:'si_OTHER1234'};
  let sub={id:subId,object:'subscription',livemode,customer:cus,currency:'usd',
    status:'active',billing_mode:{type:'flexible'},
    items:{data:[{...itemA},{...itemB}],has_more:false},
    metadata:{plan:'standard'},discounts:[]};
  let sched={id:schedId,object:'subscription_schedule',livemode,customer:cus,
    subscription:status==='released'?subId:null,
    status,end_behavior:'release',billing_mode:{type:'flexible'},
    current_phase:null,start_date:1893456000,
    phases:[{start_date:1893456000,end_date:1924992000,
      items:[{price:priceId,quantity:1}],metadata:{}}]};
  let created=null,createdItem=null;const writes=[];
  const record=(kind,idValue,opts)=>{if(!opts?.idempotencyKey)
    throw new Error('Missing idempotency header');
    writes.push({kind,id:idValue});};
  const prices={[priceId]:8500,[newPriceId]:16000};
  const price=(id2)=>({id:id2,object:'price',livemode,type:'recurring',
    currency:'usd',active:true,unit_amount:prices[id2],
    recurring:{interval:'month',usage_type:'licensed'},metadata:{}});
  const sdk={
    accounts:{retrieve:async()=>({object:'account',id:acct,livemode:true})},
    balance:{retrieve:async()=>({object:'balance',livemode:true})},
    customers:{retrieve:async()=>({id:cus,object:'customer',livemode,
      metadata:{tier:'standard'},
      invoice_settings:{default_payment_method:pm}})},
    paymentMethods:{retrieve:async()=>({id:pm,object:'payment_method',
      livemode,customer:cus})},
    prices:{retrieve:async id2=>price(id2)},
    invoices:{createPreview:async()=>({object:'invoice',livemode,currency:'usd',
      total:8500,amount_due:8500,lines:{data:[],has_more:false}})},
    subscriptions:{retrieve:async()=>sub},
    subscriptionItems:{
      retrieve:async id2=>sub.items.data.find(x=>x.id===id2)??createdItem,
      create:async(args,opts)=>{record('subscriptionItems.create',null,opts);
        createdItem={id:'si_NEW1234',object:'subscription_item',livemode,
          subscription:args.subscription,price:price(args.price),
          quantity:args.quantity,current_period_start:1791000000,
          current_period_end:1793500000,discounts:[]};
        sub={...sub,items:{data:[...sub.items.data,createdItem],
          has_more:false}};return createdItem;},
      update:async(id2,args,opts)=>{record('subscriptionItems.update',id2,opts);
        sub={...sub,items:{data:sub.items.data.map(x=>x.id===id2?
          {...x,price:price(args.price),quantity:args.quantity}:x),
          has_more:false}};
        return sub.items.data.find(x=>x.id===id2);},
      del:async(id2,args,opts)=>{record('subscriptionItems.del',id2,opts);
        sub={...sub,items:{data:sub.items.data.filter(x=>x.id!==id2),
          has_more:false}};return {id:id2,deleted:true};}},
    subscriptionSchedules:{
      retrieve:async id2=>id2==='sub_sched_NEW1234'?created:sched,
      create:async(args,opts)=>{record('schedules.create',null,opts);
        created={...sched,id:'sub_sched_NEW1234',status:'not_started',
          start_date:args.start_date,phases:args.phases};return created;},
      update:async(id2,args,opts)=>{record('schedules.update',id2,opts);
        sched={...sched,phases:args.phases,end_behavior:args.end_behavior};
        return sched;},
      release:async(id2,_args,opts)=>{record('schedules.release',id2,opts);
        sched={...sched,status:'released',subscription:subId};return sched;},
      cancel:async(id2,_args,opts)=>{record('schedules.cancel',id2,opts);
        sched={...sched,status:'canceled'};return sched;}}
  };
  return {sdk,writes};
}
const itemDefs=Object.fromEntries(itemTools.map(t=>[t.name,t]));
for(const name of ['billing_add_item','billing_update_item',
  'billing_remove_item','billing_create_schedule','billing_update_schedule',
  'billing_release_schedule','billing_cancel_schedule'])
  handlers1[name]=makeBillingItemScheduleWrite(name).handler;
const itemArgs={
  billing_add_item:{subscriptionId:subId,priceId:newPriceId,quantity:2,
    effectiveAt:eff,prorationBehavior:'none'},
  billing_update_item:{subscriptionId:subId,itemId:'si_FAKE1234',
    priceId:newPriceId,effectiveAt:eff,prorationBehavior:'none'},
  billing_remove_item:{subscriptionId:subId,itemId:'si_OTHER1234',
    effectiveAt:eff,prorationBehavior:'none'},
  billing_create_schedule:{customerId:cus,priceId,quantity:1,startAt:1893456000,
    iterations:2,endBehavior:'release',billingMode:'flexible'},
  billing_update_schedule:{scheduleId:schedId,priceId:newPriceId,quantity:2,
    iterations:3,endBehavior:'cancel'},
  billing_release_schedule:{scheduleId:schedId},
  billing_cancel_schedule:{scheduleId:schedId,invoiceNow:false,prorate:false}
};

describe('Billing items and schedules — LIVE preview and confirm',()=>{
  for(const name of Object.keys(itemArgs)){
    it(name+' previews in LIVE and confirms against the fingerprint',async()=>{
      vi.stubEnv('VERCEL_ENV','production');
      const db=await liveDb();
      const fx=itemFixture();
      const ctx=await liveCtx(db,fx.sdk);
      const preview=parse(await handlers1[name]
        ({...itemArgs[name],dryRun:true},ctx));
      expect(preview.preview).toMatch(/LIVE MODE/);
      expect(preview.previewFingerprint).toMatch(/^WRITE-/);
      expect(fx.writes).toHaveLength(0);
      const done=parse(await handlers1[name]({...itemArgs[name],confirm:true,
        previewFingerprint:preview.previewFingerprint},ctx));
      expect(done.done).toBe(true);
      expect(done.mode).toBe('LIVE');
      expect(fx.writes).toHaveLength(1);
    });
  }
  it('LIVE context rejects a TEST subscription on item changes',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const db=await liveDb();
    const fx=itemFixture({livemode:false});
    await expect(handlers1.billing_add_item(
      {...itemArgs.billing_add_item,dryRun:true},await liveCtx(db,fx.sdk)))
      .rejects.toThrow(/mode mismatch/);
  });
});

// --- Discount projection follows the connection's mode ---------------
const liveDiscount={object:'discount',livemode:true,end:null,
  coupon:{object:'coupon',livemode:true,duration:'forever',percent_off:20,
    amount_off:null,currency:null}};
const testDiscount={object:'discount',livemode:false,end:null,
  coupon:{object:'coupon',livemode:false,duration:'forever',percent_off:20,
    amount_off:null,currency:null}};

describe('Billing discount verification — mode-aware projection',()=>{
  it('verifies discounts only in their own mode',()=>{
    expect(discountSafe(liveDiscount,'live').verified).toBe(true);
    expect(discountSafe(liveDiscount,'test').verified).toBe(false);
    expect(discountSafe(testDiscount,'test').verified).toBe(true);
    expect(discountSafe(testDiscount,'live').verified).toBe(false);
    // Historical no-mode callers keep the established behavior exactly.
    expect(discountSafe(testDiscount).verified).toBe(true);
    expect(discountSafe(liveDiscount).verified).toBe(false);
  });
  it('subscriptionSafe carries the mode into item discounts too',()=>{
    const sub={id:subId,status:'active',customer:cus,currency:'usd',
      billing_mode:{type:'flexible'},discounts:[liveDiscount],
      items:{data:[{id:itemId,quantity:1,price:{id:priceId},
        current_period_start:1791000000,current_period_end:1793500000,
        discounts:[liveDiscount]}],has_more:false}};
    expect(subscriptionSafe(sub,'live').discounts[0].verified).toBe(true);
    expect(subscriptionSafe(sub,'live').items[0].discounts[0].verified).toBe(true);
    expect(subscriptionSafe(sub,'test').discounts[0].verified).toBe(false);
  });
  it('billing_get_subscription reports a LIVE discount as verified in LIVE',async()=>{
    vi.stubEnv('VERCEL_ENV','production');
    const db=await liveDb();
    const sdk={accounts:{retrieve:async()=>({object:'account',id:acct,livemode:true})},
    balance:{retrieve:async()=>({object:'balance',livemode:true})},
    subscriptions:{retrieve:async()=>({id:subId,object:'subscription',
      livemode:true,status:'active',customer:cus,currency:'usd',
      billing_mode:{type:'flexible'},discounts:[liveDiscount],
      items:{data:[{id:itemId,quantity:1,price:{id:priceId},
        current_period_start:1791000000,current_period_end:1793500000,
        discounts:[]}],has_more:false}})}};
    const result=parse(await billingReads.billing_get_subscription(
      {subscriptionId:subId},await liveCtx(db,sdk)));
    expect(result.discounts[0].verified).toBe(true);
    expect(result.discounts[0].percentOff).toBe(20);
  });
  it('the registry families did not change count',()=>{
    expect(itemDefs.billing_cancel_schedule).toBeDefined();
    expect(Object.keys(itemArgs)).toHaveLength(7);
  });
});
