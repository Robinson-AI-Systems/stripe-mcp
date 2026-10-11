// Native D-4 TEST subscription item and future schedule mutation workflows.
// No Stripe secret or LIVE operation is ever accepted by these handlers.
import {defineWrite,gone} from './write.js';
import {previewMoney} from './billing-writes.js';
import {client,ref,id,quantity,timestamp,proration,ownership,validateFields,
  safeRecurringPrice,previewSafe,previewChange,
  writeProfiles,fullProfiles} from './billing-shared.js';
import {planScheduleUpdate,verifyScheduleUpdate} from './billing-schedule-plan.js';
import {verifyItemLedger,verifyLinkedScheduleSubscription} from './billing-item-safety.js';

const sub={subscriptionId:id('sub')},item={itemId:id('si')};
const schedule={scheduleId:id('sub_sched')};
const life={...ownership};
const endBehavior={type:'string',enum:['release','cancel']};
const billingMode={type:'string',enum:['flexible','classic']};
const fields={effectiveAt:timestamp,prorationBehavior:proration};
const iterations={type:'integer',minimum:1,maximum:24};
const defs=[
  {name:'billing_add_item',description:'Add an active USD recurring TEST subscription item after an exact proration preview.',
    props:{...sub,priceId:id('price'),quantity,...fields,...life},
    required:['subscriptionId','priceId','quantity','effectiveAt','prorationBehavior'],kind:'item',money:true},
  {name:'billing_update_item',description:'Change a TEST item price or quantity with pinned invoice preview and read-back.',
    props:{...sub,...item,priceId:id('price'),quantity,...fields,...life},
    required:['subscriptionId','itemId','effectiveAt','prorationBehavior'],kind:'item',money:true},
  {name:'billing_remove_item',description:'Remove a TEST item, preserving at least one item; preview any credits first.',
    props:{...sub,...item,...fields,...life},
    required:['subscriptionId','itemId','effectiveAt','prorationBehavior'],kind:'item',money:true,destructive:true},
  {name:'billing_create_schedule',description:'Create a future TEST subscription schedule with verified price, amount, mode and start.',
    props:{customerId:id('cus'),priceId:id('price'),quantity,startAt:timestamp,
      iterations,endBehavior,billingMode,...life},
    required:['customerId','priceId','quantity','startAt','iterations','endBehavior','billingMode'],
    kind:'scheduleCreate',money:true,full:true},
  {name:'billing_update_schedule',description:'Change a pending or future active TEST schedule phase, preserving its current phase and previewing the change.',
    props:{...schedule,priceId:id('price'),quantity,iterations,endBehavior,
      effectiveAt:timestamp,replaceFuture:{type:'boolean'},...life},
    required:['scheduleId','priceId','quantity','iterations','endBehavior'],
    kind:'scheduleUpdate',money:true,full:true},
  {name:'billing_release_schedule',description:'Release an existing TEST schedule, leaving its underlying subscription in place.',
    props:{...schedule,...life},required:['scheduleId'],kind:'schedule',destructive:true,full:true},
  {name:'billing_cancel_schedule',description:'Cancel a TEST schedule and any active subscription, with explicit final invoice choices.',
    props:{...schedule,invoiceNow:{type:'boolean'},prorate:{type:'boolean'},...life},
    required:['scheduleId','invoiceNow','prorate'],kind:'schedule',
    money:true,destructive:true,full:true}
];
const today=()=>Math.floor(Date.now()/1000);
const future=t=>Number.isSafeInteger(t)&&t>=today()+300&&t<=4102444800;
const pendingStatus=new Set(['not_started','active']);
const currentItems=b=>b.items.data.map(i=>({
  id:i.id,price:ref(i.price),quantity:i.quantity}));
const validate=(d,a)=>{
  validateFields(a,d.props,d.required);
  if(d.name==='billing_update_item'&&!a.priceId&&a.quantity===undefined)
    throw new TypeError('Change a price or quantity');
  if(d.name==='billing_create_schedule'&&!future(a.startAt))
    throw new TypeError('Future schedule start must be at least 5 minutes away');
  if(d.kind==='item'&&a.prorationBehavior==='none'&&a.effectiveAt>today()+300)
    throw new TypeError('Non-prorated changes apply now; do not supply a future effectiveAt');
  if(d.kind==='item'&&a.prorationBehavior!=='none'&&a.effectiveAt>today()+300)
    throw new TypeError('Item prorations must occur now; future changes require a schedule');
};
async function priceFor(s,priceId){
  const price=safeRecurringPrice(await s.prices.retrieve(priceId));
  if(!['day','week','month','year'].includes(price.recurring.interval)||
    !Number.isInteger(price.recurring.interval_count??1)||
    (price.recurring.interval_count??1)<1)
    throw new TypeError('A verified recurring billing interval is required');
  return price;
}
function phase(priceId,amount,cycles){
  return {items:[{price:priceId,quantity:amount}],iterations:cycles,
    proration_behavior:'none'};
}
function validSchedule(b){
  if(!b||!pendingStatus.has(b.status)||typeof b.customer!=='string'||
    !Array.isArray(b.phases))
    throw new TypeError('Complete editable TEST schedule required');
  return b;
}
async function schedulePreview(s,{customerId,phases,start,mode,idValue,end}){
  const details={phases,end_behavior:end};
  if(idValue){
    details.proration_behavior='none';
  }else{
    if(!future(start))throw new TypeError('Schedule must start in the future');
    details.start_date=start;
    details.billing_mode={type:mode};
  }
  const invoice=await s.invoices.createPreview({
    customer:customerId,currency:'usd',
    ...(idValue?{schedule:idValue}:{}),schedule_details:details
  });
  return previewSafe(invoice,start,'none');
}
async function beforeFor(d,a,s,ctx){
  if(d.kind==='item'){
    const b=verifyItemLedger(await s.subscriptions.retrieve(a.subscriptionId));
    if(!['active','trialing','past_due'].includes(b.status))
      throw new TypeError('Item changes require a mutable TEST subscription');
    const originals=currentItems(b);
    let proposal=null;
    if(d.name==='billing_add_item'){
      await priceFor(s,a.priceId);
      proposal={price:a.priceId,quantity:a.quantity};
    }else{
      const current=b.items.data.find(x=>x.id===a.itemId);
      if(!current)throw new TypeError('Item is not in this subscription');
      if(d.name==='billing_remove_item'&&b.items.data.length<2)
        throw new TypeError('Removing the final item would cancel the subscription');
      if(a.priceId)await priceFor(s,a.priceId);
      proposal={id:current.id,price:a.priceId??ref(current.price),
        quantity:a.quantity??current.quantity};
    }
    b._proposal=proposal;
    const items=d.name==='billing_add_item'?[
      ...originals,proposal]:
      d.name==='billing_remove_item'?
        originals.filter(x=>x.id!==a.itemId):
        originals.map(x=>x.id===a.itemId?proposal:x);
    b._preview=await previewChange(s,b,items,a.effectiveAt,a.prorationBehavior);
    return b;
  }
  if(d.kind==='scheduleCreate'){
    const customer=await s.customers.retrieve(a.customerId);
    if(customer?.deleted||!customer?.metadata)
      throw new TypeError('Verified customer metadata required');
    const pmId=ref(customer.invoice_settings?.default_payment_method);
    if(!pmId||!/^pm_[A-Za-z0-9]{2,100}$/.test(pmId))
      throw new TypeError('Future schedule customer requires a verified saved payment method');
    const method=await s.paymentMethods.retrieve(pmId);
    if(ref(method.customer)!==customer.id)
      throw new TypeError('Future billing payment method belongs to another customer');
    await priceFor(s,a.priceId);
    const phases=[phase(a.priceId,a.quantity,a.iterations)];
    const preview=await schedulePreview(s,{customerId:customer.id,phases,
      start:a.startAt,mode:a.billingMode,end:a.endBehavior});
    return {...customer,_phases:phases,_preview:preview};
  }
  const b=validSchedule(await s.subscriptionSchedules.retrieve(a.scheduleId));
  b._linked=await verifyLinkedScheduleSubscription(s,b,a,ctx);
  if(d.kind==='scheduleUpdate'){
    const patch=planScheduleUpdate(b,a);
    await priceFor(s,a.priceId);
    if(patch.active){
      await priceFor(s,patch.phases[0].items[0].price);
    }
    b._phases=patch.phases;
    b._preview=await schedulePreview(s,{customerId:ref(b.customer),
      phases:b._phases,start:patch.effectiveAt,mode:b.billing_mode.type,
      idValue:b.id,end:a.endBehavior});
  }
  if(d.name==='billing_cancel_schedule'&&b.status==='active'&&
    (a.prorate===true||a.invoiceNow===true)){
    if(!ref(b.subscription))throw new TypeError('Active schedule subscription unknown');
    const invoice=await s.invoices.createPreview({
      customer:ref(b.customer),subscription:ref(b.subscription),currency:'usd',
      subscription_details:{cancel_now:true,proration_behavior:
        a.prorate?'create_prorations':'none'}
    });
    b._preview=previewSafe(invoice,null,a.prorate?'create_prorations':'none');
  }
  return b;
}
function ensureGood(d,a,b){
  if(b._linked?._appDecision!==undefined&&b._linked._appDecision!==true)
    return b._linked._appDecision;
  if(b.deleted)return 'Deleted Stripe target';
  if(d.kind==='item'&&b.items.has_more)return 'Subscription item list incomplete';
  if(d.kind==='scheduleUpdate'&&!['not_started','active'].includes(b.status))
    return 'Schedule cannot be edited in its current status';
  if(d.name==='billing_release_schedule'&&!pendingStatus.has(b.status))
    return 'Only pending or active subscription schedules can be released';
  if(d.name==='billing_cancel_schedule'&&!pendingStatus.has(b.status))
    return 'Schedule is not cancelable';
  if(d.kind==='scheduleCreate'&&!future(a.startAt))
    return 'Start date is no longer in the future';
  return true;
}
function build(d){
  let created=null;
  const op=defineWrite({
    name:d.name,allowZeroPreview:true,
    read:async(a,ctx)=>{
      validate(d,a);
      return beforeFor(d,a,await client(ctx),ctx);
    },
    summarize:async(b,a)=>{
      const preview=b._preview;
      return 'TEST MODE. '+d.name+' target '+b.id+'; '+
        (preview?'provider preview '+preview.invoiceTotalCents+' cents USD'+
          ', proration '+preview.prorationBehavior+
          ', effective at '+(preview.effectiveAt??'provider current time')+'; ':'')+
        'fields '+Object.keys(a).filter(k=>!['confirm','dryRun','requestKey','outsideApp'].includes(k))
          .join(', ')+'. Confirmed only after an independent Stripe read-back.';
    },
    money:d.money?async(a,_ctx,b)=>{
      if(!b._preview)return null;
      return previewMoney(b._preview,d.name+' verified invoice',
        d.name==='billing_cancel_schedule'&&b._linked?.id?b._linked.id:b.id);
    }:undefined,
    targetGuard:(a,_ctx,b)=>ensureGood(d,a,b),
    apply:async(a,ctx,{idempotencyKey,before:b})=>{
      const s=await client(ctx),opts={idempotencyKey};
      switch(d.name){
        case 'billing_add_item':
          created=await s.subscriptionItems.create({
            subscription:b.id,price:a.priceId,quantity:a.quantity,
            proration_behavior:a.prorationBehavior,
            ...(a.prorationBehavior==='none'?{}:{proration_date:a.effectiveAt})
          },opts);break;
        case 'billing_update_item':
          await s.subscriptionItems.update(a.itemId,{
            price:b._proposal.price,quantity:b._proposal.quantity,
            proration_behavior:a.prorationBehavior,
            ...(a.prorationBehavior==='none'?{}:{proration_date:a.effectiveAt})
          },opts);break;
        case 'billing_remove_item':
          await s.subscriptionItems.del(a.itemId,{
            proration_behavior:a.prorationBehavior,
            ...(a.prorationBehavior==='none'?{}:{proration_date:a.effectiveAt})
          },opts);break;
        case 'billing_create_schedule':
          created=await s.subscriptionSchedules.create({
            customer:b.id,start_date:a.startAt,end_behavior:a.endBehavior,
            billing_mode:{type:a.billingMode},
            phases:b._phases
          },opts);break;
        case 'billing_update_schedule':
          await s.subscriptionSchedules.update(b.id,{
            phases:b._phases,end_behavior:a.endBehavior,
            proration_behavior:'none'
          },opts);break;
        case 'billing_release_schedule':
          await s.subscriptionSchedules.release(b.id,{},opts);break;
        case 'billing_cancel_schedule':
          await s.subscriptionSchedules.cancel(b.id,{
            invoice_now:a.invoiceNow,prorate:a.prorate
          },opts);break;
        default:throw new TypeError('Unknown TEST billing operation');
      }
    },
    readAfter:async(a,ctx)=>{
      const s=await client(ctx);
      if(d.name==='billing_add_item'||d.name==='billing_update_item')
        return s.subscriptionItems.retrieve(
          d.name==='billing_add_item'?created?.id:a.itemId);
      if(d.name==='billing_remove_item')
        return s.subscriptions.retrieve(a.subscriptionId);
      if(d.name==='billing_create_schedule')
        return created?.id?s.subscriptionSchedules.retrieve(created.id):null;
      return s.subscriptionSchedules.retrieve(a.scheduleId);
    },
    verify:(b,after,a)=>{
      if(!after)return false;
      switch(d.name){
        case 'billing_add_item':
          return after.id===created?.id&&ref(after.subscription)===b.id&&
            ref(after.price)===a.priceId&&after.quantity===a.quantity;
        case 'billing_update_item':
          return after.id===a.itemId&&ref(after.price)===b._proposal.price&&
            after.quantity===b._proposal.quantity;
        case 'billing_remove_item':
          return after.id===b.id&&Array.isArray(after.items?.data)&&
            after.items.has_more===false&&
            !after.items.data.some(x=>x.id===a.itemId);
        case 'billing_create_schedule':
          return after.id===created?.id&&after.status==='not_started'&&
            ref(after.customer)===b.id&&after.start_date===a.startAt&&
            after.billing_mode?.type===a.billingMode&&
            after.end_behavior===a.endBehavior&&
            after.phases?.[0]?.items?.some(i=>
              ref(i.price)===a.priceId&&i.quantity===a.quantity);
        case 'billing_update_schedule':
          return verifyScheduleUpdate(b,after,a);
        case 'billing_release_schedule':
          return after.id===b.id&&after.status==='released';
        case 'billing_cancel_schedule':
          return after.id===b.id&&after.status==='canceled';
        default:return false;
      }
    }
  });
  return {...op,handler:async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test')return gone('TEST-only subscription operation');
    return op.handler(a,ctx);
  }};
}
export const tools=defs.map(d=>{
  const op=build(d);
  return {...op.tool,area:'billing',
    profiles:d.full?fullProfiles:writeProfiles,
    description:d.description,
    annotations:{destructiveHint:d.destructive===true},
    inputSchema:{type:'object',properties:{...d.props,
      confirm:{type:'boolean'},dryRun:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:d.required,additionalProperties:false}};
});
export const handlers=Object.fromEntries(defs.map(d=>[
  d.name,async(a,ctx)=>{
    const s=await client(ctx);
    return build(d).handler(a,{...ctx,getCustomer:id=>s.customers.retrieve(id)});
  }
]));
export function makeBillingItemScheduleWrite(name){
  const def=defs.find(d=>d.name===name);
  if(!def)throw new TypeError('Unknown item or schedule write');
  return build(def);
}
