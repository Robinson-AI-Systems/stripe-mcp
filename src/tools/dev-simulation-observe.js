// Independently confirm monthly TEST renewal evidence before unlocking next month.
import {defineWrite,gone} from './write.js';
import {client,ref,reply} from './billing-shared.js';
import {loadSimulation} from './dev-simulation-advance.js';

const bad=m=>{throw new TypeError(m);};
const valid=(v,p)=>typeof v==='string'&&new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(v);
const eventTypes=['invoice.payment_succeeded','invoice.paid','invoice.payment_failed'];
export async function verifySimulationMonth(p,cycle,s){
  const target=cycle.targetFrozenTime;
  const [clock,sub,price]=await Promise.all([
    s.testHelpers.testClocks.retrieve(p.ids.test_clock),
    s.subscriptions.retrieve(p.ids.subscription),
    s.prices.retrieve(p.ids.price)]);
  if(clock?.object!=='test_helpers.test_clock'||clock.id!==p.ids.test_clock||
    clock.livemode!==false||clock.status!=='ready'||
    clock.frozen_time!==target||clock.name!=='RTC DEV RUN '+p.run.id+' 1'||
    sub?.object!=='subscription'||sub.id!==p.ids.subscription||
    sub.livemode!==false||sub.metadata?.rtc_run!==p.run.id||
    ref(sub.customer)!==p.ids.customer||ref(sub.test_clock)!==p.ids.test_clock||
    !Array.isArray(sub.items?.data)||sub.items.has_more===true||
    !sub.items.data.some(i=>ref(i.price)===p.ids.price)||
    price?.object!=='price'||price.id!==p.ids.price||
    price.livemode!==false||price.metadata?.rtc_run!==p.run.id||
    price.type!=='recurring'||price.currency!=='usd'||
    price.recurring?.interval!=='month'||
    !Number.isSafeInteger(price.unit_amount)||price.unit_amount<100||
    price.unit_amount>50000)
    bad('Exact ready TEST clock, subscription and recurring price not independently verified');
  const invoices=await s.invoices.list({subscription:p.ids.subscription,limit:100});
  if(!Array.isArray(invoices?.data)||invoices.has_more!==false)
    bad('Subscription invoice history is incomplete');
  const previous=p.cycles.find(x=>x.cycle===cycle.cycle-1);
  const lower=previous?previous.targetFrozenTime:
    (sub.trial_start??sub.start_date??0);
  const matching=invoices.data.filter(x=>x?.object==='invoice'&&
    x.livemode===false&&valid(x.id,'in')&&
    Number.isSafeInteger(x.created)&&x.created>=lower&&x.created<=target&&
    x.total===price.unit_amount&&x.currency==='usd'&&
    ref(x.customer)===p.ids.customer);
  if(matching.length!==1)
    bad('Exactly one full-price run-owned monthly TEST invoice is required');
  const listed=matching[0],inv=await s.invoices.retrieve(listed.id);
  const linked=ref(inv?.parent?.subscription_details?.subscription)??ref(inv?.subscription);
  if(inv?.object!=='invoice'||inv.id!==listed.id||inv.livemode!==false||
    inv.status!==listed.status||!['paid','open'].includes(inv.status)||
    linked!==p.ids.subscription||ref(inv.customer)!==p.ids.customer||
    inv.currency!=='usd'||inv.total!==price.unit_amount||
    !Number.isSafeInteger(inv.attempt_count)||inv.attempt_count<1)
    bad('Independently retrieved TEST invoice differs from monthly plan');
  const paid=inv.status==='paid';
  const allocations=await s.invoicePayments.list({invoice:inv.id,limit:100});
  if(!Array.isArray(allocations?.data)||allocations.has_more!==false||
    allocations.data.length>2||allocations.data.some(x=>
      x?.object!=='invoice_payment'||ref(x.invoice)!==inv.id||
      x.livemode===true))
    bad('TEST invoice payment allocations are incomplete or foreign');
  let paymentIntentId=null,paymentStatus='unavailable';
  if(paid){
    if(inv.amount_paid!==price.unit_amount||inv.amount_remaining!==0)
      bad('TEST invoice did not receive exact full payment');
    const full=allocations.data.filter(x=>
      x.status==='paid'&&x.amount_paid===price.unit_amount&&
      valid(ref(x.payment?.payment_intent),'pi'));
    if(full.length!==1)bad('No unique settled TEST card payment allocation');
    paymentIntentId=ref(full[0].payment.payment_intent);
  }else{
    if(inv.amount_paid!==0||inv.amount_remaining!==price.unit_amount||
      allocations.data.some(x=>x.status==='paid'&&x.amount_paid>0))
      bad('Unpaid TEST renewal contains recorded settlement');
    const linkedPIs=allocations.data.map(x=>ref(x.payment?.payment_intent))
      .filter(Boolean);
    if(linkedPIs.length>1)bad('Multiple payment attempts require manual review');
    paymentIntentId=linkedPIs[0]??null;
  }
  if(paymentIntentId!==null){
    if(!valid(paymentIntentId,'pi'))bad('TEST PaymentIntent identity unavailable');
    const pi=await s.paymentIntents.retrieve(paymentIntentId);
    if(pi?.object!=='payment_intent'||pi.id!==paymentIntentId||
      pi.livemode!==false||ref(pi.customer)!==p.ids.customer||
      pi.currency!=='usd'||pi.amount!==price.unit_amount||
      (paid?(pi.status!=='succeeded'||pi.amount_received!==price.unit_amount):
        (!['requires_payment_method','requires_action','processing','canceled']
          .includes(pi.status)||pi.amount_received!==0)))
      bad('Stripe PaymentIntent did not independently confirm the billing outcome');
    paymentStatus=pi.status;
  }
  if(paid&&paymentStatus!=='succeeded')bad('Paid TEST invoice has no verified succeeded PI');
  const accepted=paid?eventTypes.slice(0,2):eventTypes.slice(2);
  let cursor,event=null;
  for(let pageNumber=0;pageNumber<3&&!event;pageNumber++){
    const page=await s.events.list({types:accepted,limit:100,
      ...(cursor?{starting_after:cursor}:{})});
    if(!Array.isArray(page?.data)||typeof page.has_more!=='boolean'||
      page.data.length>100)bad('Original TEST Event listing is unverifiable');
    const candidate=page.data.find(e=>valid(e?.id,'evt')&&
      accepted.includes(e.type)&&e.livemode===false&&
      (!e.account||e.account===p.account)&&
      e.data?.object?.object==='invoice'&&e.data.object.id===inv.id);
    if(candidate){
      const observed=await s.events.retrieve(candidate.id);
      if(observed?.object!=='event'||observed.id!==candidate.id||
        observed.type!==candidate.type||observed.livemode!==false||
        (observed.account&&observed.account!==p.account)||
        observed.data?.object?.id!==inv.id||
        observed.data.object.object!=='invoice'||
        ref(observed.data.object.customer)!==p.ids.customer)
        bad('Original Stripe TEST Event readback does not match renewal');
      event={id:observed.id,type:observed.type};break;
    }
    if(!page.has_more)break;
    cursor=page.data.at(-1)?.id;
    if(!valid(cursor,'evt'))bad('Invalid original Stripe Event cursor');
  }
  if(!event)bad('Matching original Stripe TEST invoice Event not yet observed');
  return {observedClockTime:target,invoiceId:inv.id,invoiceStatus:inv.status,
    paymentIntentId,paymentStatus,eventId:event.id,eventType:event.type};
}
export function makeSimulationObserveWrite(){
  let outcome=null;
  const op=defineWrite({
    name:'dev_simulate_subscription',
    read:async(a,ctx)=>{
      if(!a||typeof a!=='object'||Array.isArray(a)||
        Object.keys(a).some(k=>!['action','runId','cycle','requestKey',
          'dryRun','confirm'].includes(k))||a.action!=='observe'||
        !Number.isInteger(a.cycle)||a.cycle<1||a.cycle>3||
        typeof a.requestKey!=='string'||a.requestKey.length<1||
        a.requestKey.length>128)
        bad('Exact TEST cycle observation action and requestKey required');
      const p=await loadSimulation(a,ctx),cycle=p.cycles.find(x=>x.cycle===a.cycle);
      if(!cycle||cycle.requestKey!==a.requestKey||
        !['uncertain','observed'].includes(cycle.state)||
        typeof ctx.db?.observeDevSimulationCycle!=='function')
        bad('Recorded attempted account-owned TEST cycle and outcome store required');
      return {...p,cycle,metadata:{}};
    },
    summarize:p=>'TEST MODE. Reconcile invoice, allocation, PaymentIntent and original '+
      'Stripe Event for run '+p.run.id+' month '+p.cycle.cycle+
      '. No Stripe provider mutation. Only independent exact evidence '+
      'marks a cycle observed; missing evidence remains uncertain.',
    apply:async(a,ctx,{before})=>{
      outcome=null;
      if(before.cycle.state==='observed'){
        outcome={alreadyObserved:true};return;
      }
      const verified=await verifySimulationMonth(before,before.cycle,await client(ctx));
      if(!await ctx.db.observeDevSimulationCycle({
        accountId:before.account,runId:before.run.id,
        cycle:a.cycle,requestKey:a.requestKey,
        targetFrozenTime:before.cycle.targetFrozenTime,...verified
      }))bad('Exact Stripe TEST observation could not be durably stored');
      outcome={newlyObserved:true};
    },
    readAfter:(a,ctx)=>ctx.db.getDevSimulationCycles({
      accountId:ctx.connection.stripeAccount,runId:a.runId}),
    verify:(p,rows)=>Array.isArray(rows)&&rows.some(x=>
      x.cycle===p.cycle.cycle&&x.targetFrozenTime===p.cycle.targetFrozenTime&&
      x.state==='observed'&&valid(x.invoiceId,'in')&&valid(x.eventId,'evt'))
  });
  return {...op,async handler(a,ctx){
    if(ctx?.connection?.mode!=='test')return gone('TEST-only billing outcome verification');
    const response=await op.handler(a,ctx);
    if(response?.isError||a?.confirm!==true||a?.dryRun===true)return response;
    const payload=JSON.parse(response.content[0].text);
    const rows=await ctx.db.getDevSimulationCycles({
      accountId:ctx.connection.stripeAccount,runId:a.runId});
    const row=rows.find(x=>x.cycle===a.cycle);
    return reply({...payload,monthlyOutcome:row?{
      cycle:row.cycle,state:row.state,invoiceId:row.invoiceId,
      invoiceStatus:row.invoiceStatus,paymentIntentId:row.paymentIntentId,
      paymentStatus:row.paymentStatus,eventId:row.eventId,eventType:row.eventType
    }:null,...(outcome?.alreadyObserved?{alreadyObserved:true}:{}),
    note:'Original Stripe TEST Event observed. Webhook delivery to an application is NOT proved.'});
  }};
}
