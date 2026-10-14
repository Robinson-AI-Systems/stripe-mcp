// Curated real Stripe TEST events from actual audited provider actions.
// No fake CLI fixture or simulated event success response.
import {createHash} from 'node:crypto';
import {invoiceEventTypes,isInvoiceEvent,verifyInvoiceFixture,
  matchesInvoiceEvent,mutateInvoiceForEvent,ensureInvoiceMutation}
  from './triggers-invoices.js';
import {subscriptionEventTypes,isSubscriptionEvent,verifySubscriptionObject,
  matchingSubscriptionEvent,verifyTrialInvoice,cancelTrialSubscription}
  from './triggers-subscriptions.js';
import {mutationTypes,requiresTriggerMutation,mutateEventSource,
  assertMutatedEvent} from './triggers-updates.js';
import {failedPaymentEventTypes,isFailedPaymentEvent,verifyFailedPayment,
  ensureFailedPayment,matchesFailedPaymentEvent} from './triggers-failures.js';
import {disputeEventTypes,isDisputeEvent,verifiedDisputeCharge,
  verifiedDisputeObject,findActualDispute,matchesDisputeEvent}
  from './triggers-disputes.js';
import {invoiceFailureTypes,isInvoiceFailureEvent,verifyFailedInvoiceSource,
  verifyFailedInvoiceItem,ensureFailedInvoicePayment,matchesInvoiceFailureEvent}
  from './triggers-invoice-failure.js';
import {paymentMethodEventTypes,isPaymentMethodEvent,
  verifyMethodFixture,matchesPaymentMethodEvent,ensurePaymentMethodEvent}
  from './triggers-payment-methods.js';
import {invoiceTerminalEventTypes,isInvoiceTerminalEvent,
  verifyTerminalInvoice,verifyTerminalItem,matchesTerminalInvoiceEvent,
  ensureTerminalInvoiceEvent} from './triggers-invoice-terminal.js';
import {setupIntentEventTypes,isSetupIntentEvent,verifySetupIntent,
  matchesSetupIntentEvent,ensureSetupIntentEvent}
  from './triggers-setup-intents.js';
import {checkoutEventTypes,isCheckoutEvent,verifyCheckoutSession,
  verifyCheckoutPayment,matchesCheckoutEvent} from './triggers-checkout.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const bad=x=>{throw new TypeError(x);};
const id=(v,p)=>typeof v==='string'&&new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(v);
const ref=x=>typeof x==='string'?x:x?.id;
export const triggerTypes=Object.freeze([
  'customer.created','product.created','price.created',
  'payment_intent.created','payment_intent.succeeded',...mutationTypes,...subscriptionEventTypes,
  ...invoiceEventTypes,...failedPaymentEventTypes,...disputeEventTypes,
  ...invoiceFailureTypes,...checkoutEventTypes,...paymentMethodEventTypes,...setupIntentEventTypes,...invoiceTerminalEventTypes
]);
const kind={customer:'customer',product:'product',price:'price',
  payment_intent:'payment_intent',subscription:'subscription',invoice:'invoice',
  charge:'charge',dispute:'dispute',invoice_item:'invoiceitem',
  payment_method:'payment_method',checkout_session:'checkout.session',setup_intent:'setup_intent'};
const prefix={customer:'cus',product:'prod',price:'price',
  payment_intent:'pi',subscription:'sub',invoice:'in',charge:'ch',dispute:'du',
  invoice_item:'ii',payment_method:'pm',checkout_session:'cs_test',setup_intent:'seti',event:'evt'};
const read=async(s,type,providerId)=>{
  switch(type){
    case 'customer':return s.customers.retrieve(providerId);
    case 'product':return s.products.retrieve(providerId);
    case 'price':return s.prices.retrieve(providerId);
    case 'payment_intent':return s.paymentIntents.retrieve(providerId);
    case 'subscription':return s.subscriptions.retrieve(providerId);
    case 'invoice':return s.invoices.retrieve(providerId);
    case 'charge':return s.charges.retrieve(providerId);
    case 'dispute':return s.disputes.retrieve(providerId);
    case 'invoice_item':return s.invoiceItems.retrieve(providerId);
    case 'payment_method':return s.paymentMethods.retrieve(providerId);
    case 'setup_intent':return s.setupIntents.retrieve(providerId);
    case 'checkout_session':return s.checkout.sessions.retrieve(providerId);
    default:bad('Unsupported TEST provider fixture');
  }
};
export function planTrigger(a,account,{legacyInvoiceFailure=false}={}){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['type','requestKey','dryRun','confirm'].includes(k))||
    !triggerTypes.includes(a.type)||!id(account,'acct')||
    typeof a.requestKey!=='string'||a.requestKey.length<1||
    a.requestKey.length>128)bad('Unsupported TEST event or retry key; use dev_list_triggers');
  const runId='run_'+hash(JSON.stringify([account,a.requestKey])).slice(0,24);
  const types=isInvoiceTerminalEvent(a.type)?['customer','invoice','invoice_item']:
    isSetupIntentEvent(a.type)?['setup_intent']:
    isPaymentMethodEvent(a.type)?['customer','payment_method']:
    isCheckoutEvent(a.type)?
    ['product','price','customer','checkout_session','payment_intent']:
    isInvoiceFailureEvent(a.type)?
    (legacyInvoiceFailure?['customer','invoice','invoice_item']:
      ['customer','invoice','invoice_item','payment_method']):
    isDisputeEvent(a.type)?
    ['customer','payment_intent','charge','dispute']:
    isInvoiceEvent(a.type)?['customer','invoice']:
    isSubscriptionEvent(a.type)?
    ['product','price','customer','subscription','invoice']:
    a.type.startsWith('price.')?['product','price']:
    a.type.startsWith('payment_intent.')?['customer','payment_intent']:
    [a.type.split('.')[0]];
  const steps=types.map(type=>({name:type+'_1',type}))
    .concat([{name:'event_1',type:'event'}]);
  return {runId,legacyInvoiceFailure,
    scenario:'event-'+a.type.replaceAll('_','-').replaceAll('.','-'),
    type:a.type,steps,size:1,expectedSteps:steps.length,
    planDigest:hash(JSON.stringify([a.type,steps])),amountCents:
      a.type==='payment_intent.succeeded'||isDisputeEvent(a.type)?3600:0};
}
// Preserve the old immutable failed-invoice plan for recorded unfinished runs.
// New runs record their declining card as a distinct owned cleanup step.
export function resolveTriggerPlan(a,account,recorded=null){
  const current=planTrigger(a,account);
  if(!recorded||recorded.plan_digest===current.planDigest)return current;
  if(isInvoiceFailureEvent(a.type)){
    const legacy=planTrigger(a,account,{legacyInvoiceFailure:true});
    if(recorded.plan_digest===legacy.planDigest)return legacy;
  }
  return current;
}
function verifyFixture(plan,step,x,objects){
  if(x?.object!==kind[step.type]||!id(x.id,prefix[step.type])||
    x.livemode!==false||(!isDisputeEvent(plan.type)||
      !['charge','dispute'].includes(step.type))&&
      x.metadata?.rtc_run!==plan.runId)
    bad('Independent Stripe TEST event fixture provenance differs');
  if(step.type==='price'&&(
    ref(x.product)!==objects.get('product_1')?.object_id||
    x.currency!=='usd'||x.amount!==undefined&&x.amount!==3600||
    x.unit_amount!==3600||
    (isSubscriptionEvent(plan.type)?
      x.recurring?.interval!=='month':x.type!=='one_time')))
    bad('TEST event price differs from exact immutable plan');
  if(step.type==='payment_intent'&&(
    x.amount!==3600||x.amount_received!==
      (['payment_intent.canceled','payment_intent.created'].includes(plan.type)||
        isFailedPaymentEvent(plan.type)?0:3600)||
    x.currency!=='usd'||
    (isFailedPaymentEvent(plan.type)?
      !['requires_confirmation','requires_payment_method'].includes(x.status):
      plan.type==='payment_intent.created'?x.status!=='requires_confirmation':
      plan.type==='payment_intent.canceled'?
      !['requires_confirmation','canceled'].includes(x.status):
      x.status!=='succeeded')||ref(x.customer)!==
      objects.get('customer_1')?.object_id))
    bad('Stripe did not independently confirm full TEST card payment');
  if(isFailedPaymentEvent(plan.type)&&step.type==='payment_intent')
    verifyFailedPayment(plan,x,objects.get('customer_1')?.object_id);
  if(isDisputeEvent(plan.type)&&step.type==='charge')
    verifiedDisputeCharge(plan,x,objects);
  if(isDisputeEvent(plan.type)&&step.type==='dispute')
    verifiedDisputeObject(plan,x,objects);
  if(isInvoiceFailureEvent(plan.type)&&step.type==='invoice_item')
    verifyFailedInvoiceItem(plan,x,objects);
  if(isInvoiceTerminalEvent(plan.type)&&step.type==='invoice_item')
    verifyTerminalItem(plan,x,objects);
  if(isInvoiceTerminalEvent(plan.type)&&step.type==='invoice')
    verifyTerminalInvoice(plan,x,objects);
  if(isCheckoutEvent(plan.type)&&step.type==='checkout_session')
    verifyCheckoutSession(plan,x,objects);
  if(isCheckoutEvent(plan.type)&&step.type==='payment_intent')
    verifyCheckoutPayment(plan,x,objects);
  if(step.type==='payment_method'){
    if(isPaymentMethodEvent(plan.type))
      verifyMethodFixture(plan,x,objects);
    else if(x.type!=='card'||
      ref(x.customer)!==objects.get('customer_1')?.object_id)
      bad('Tracked TEST declining PaymentMethod is not linked to the exact customer');
  }
  if(step.type==='setup_intent')verifySetupIntent(plan,x);
  if(step.type==='subscription')verifySubscriptionObject(plan,x,objects);
  if(step.type==='invoice'){
    if(isInvoiceFailureEvent(plan.type))
      verifyFailedInvoiceSource(plan,x,objects);
    else if(isInvoiceEvent(plan.type))verifyInvoiceFixture(plan,x,objects);
    else if(x.status!=='paid'||x.amount_paid!==0||x.currency!=='usd'||
      ref(x.customer)!==objects.get('customer_1')?.object_id)
      bad('Automatically created TEST trial invoice was not verified');
  }
  return x;
}
function matchingEvent(e,plan,account,target){
  if(isDisputeEvent(plan.type))
    return matchesDisputeEvent(e,plan,account,target);
  const object=e?.data?.object;
  return e?.object==='event'&&id(e.id,'evt')&&e.type===plan.type&&
    e.livemode===false&&(!e.account||e.account===account)&&
    object?.object===kind[target.type]&&object.id===target.id&&
    object.metadata?.rtc_run===plan.runId&&
    assertMutatedEvent(plan,object)&&
    matchingSubscriptionEvent(plan,object,target)&&
    matchesInvoiceEvent(plan,object,target)&&
    matchesInvoiceFailureEvent(plan,object,target)&&
    matchesCheckoutEvent(plan,object,target)&&
    matchesFailedPaymentEvent(plan,object,target)&&
    matchesPaymentMethodEvent(plan,object,target)&&
    matchesSetupIntentEvent(plan,object,target)&&
    matchesTerminalInvoiceEvent(plan,object,target)&&
    (target.type!=='payment_intent'||(
      object.status===(isFailedPaymentEvent(plan.type)?
        'requires_payment_method':plan.type==='payment_intent.created'?
        'requires_confirmation':plan.type==='payment_intent.canceled'?
        'canceled':'succeeded')&&object.amount===3600&&
      object.amount_received===(['payment_intent.canceled','payment_intent.created'].includes(plan.type)||
        isFailedPaymentEvent(plan.type)?0:3600)&&
      object.currency==='usd'&&ref(object.customer)===target.customer));
}
export async function findGeneratedEvent(s,plan,account,target){
  let cursor=null;
  for(let page=0;page<3;page++){
    const listed=await s.events.list({type:plan.type,limit:100,
      ...(cursor?{starting_after:cursor}:{})});
    if(!Array.isArray(listed?.data)||typeof listed.has_more!=='boolean'||
      listed.data.length>100)
      bad('Stripe TEST event listing failed validation');
    for(const event of listed.data)if(matchingEvent(event,plan,account,target)){
      const reloaded=await s.events.retrieve(event.id);
      if(!matchingEvent(reloaded,plan,account,target))
        bad('Stripe event read-back changed identity or ownership');
      return event.id;
    }
    if(!listed.has_more||!listed.data.length)return null;
    cursor=listed.data.at(-1)?.id;
    if(!id(cursor,'evt'))bad('Invalid TEST event paging cursor');
  }
  return null; // limited retention: unknown, never "event did not occur"
}
export async function executeTrigger({plan,run,stripe:s,db,account,rootKey}){
  if(run.status==='completed')return run;
  if(plan.legacyInvoiceFailure)
    bad('Legacy failed-invoice TEST run is read-only; inspect original sources, never replay an untracked payment method');
  if(run.status!=='running'||Date.now()-new Date(run.created_at).getTime()>43200000)
    bad('Stale/uncertain TEST event run cannot be safely resumed');
  const existing=await db.getDevRunObjects({account,id:plan.runId});
  if(!Array.isArray(existing))bad('TEST event ledger unavailable');
  const byStep=new Map(existing.map(x=>[x.step_name,x]));
  const metadata={rtc_run:plan.runId};
  for(const step of plan.steps.filter(x=>x.type!=='event')){
    const recorded=byStep.get(step.name);
    let resourceId=recorded?.object_id;
    if(recorded&&(recorded.cleaned!==false||recorded.object_type!==step.type||
      !id(resourceId,prefix[step.type])))
      bad('TEST event seed object identity differs from the run ledger');
    if(!recorded){
      const opts={idempotencyKey:rootKey+'_'+step.name};
      let made;
      switch(step.type){
        case 'customer':made=await s.customers.create({
          name:'RTC Event Test Customer',metadata,
          email:'rtc-event+'+plan.runId+'@example.test'},opts);break;
        case 'product':made=await s.products.create({
          name:'RTC Event Test Product',metadata},opts);break;
        case 'price':{
          const product=byStep.get('product_1')?.object_id;
          if(!id(product,'prod'))bad('Verified TEST event product must precede price');
          made=await s.prices.create({
            product,unit_amount:3600,currency:'usd',metadata,
            ...(isSubscriptionEvent(plan.type)?{
              recurring:{interval:'month'}}:{})},opts);break;
        }
        case 'payment_intent':{
          if(isCheckoutEvent(plan.type)){
            const sid=byStep.get('checkout_session_1')?.object_id;
            if(!id(sid,'cs_test'))bad('Recorded TEST hosted Checkout required');
            const session=await s.checkout.sessions.retrieve(sid);
            verifyCheckoutSession(plan,session,byStep);
            if(session.status!=='complete'||session.payment_status!=='paid')
              return db.getDevRun({account,requestKey:run.request_key});
            verifyCheckoutSession(plan,session,byStep,true);
            const pi=ref(session.payment_intent);
            if(!id(pi,'pi'))bad('Checkout did not produce exact TEST payment');
            made=await s.paymentIntents.retrieve(pi);
            break;
          }
          const customer=byStep.get('customer_1')?.object_id;
          if(!id(customer,'cus'))bad('Verified TEST event customer must precede payment');
          made=await s.paymentIntents.create({
            customer,amount:3600,currency:'usd',
            ...(isFailedPaymentEvent(plan.type)?{}:
              {payment_method:isDisputeEvent(plan.type)?
                'pm_card_createDispute':'pm_card_visa'}),
            confirm:!['payment_intent.canceled','payment_intent.created']
              .includes(plan.type)&&!isFailedPaymentEvent(plan.type),metadata,
            description:'Tracked synthetic TEST event charge'
          },opts);break;
        }
        case 'charge':{
          const piId=byStep.get('payment_intent_1')?.object_id;
          if(!id(piId,'pi'))bad('Verified dispute TEST payment required');
          const pi=await s.paymentIntents.retrieve(piId);
          verifyFixture(plan,{type:'payment_intent'},pi,byStep);
          const chargeId=ref(pi.latest_charge);
          if(!id(chargeId,'ch'))
            bad('Stripe TEST payment has no independently linked charge');
          made=await s.charges.retrieve(chargeId);
          break;
        }
        case 'dispute':{
          made=await findActualDispute(s,plan,byStep);
          if(!made)return db.getDevRun({account,requestKey:run.request_key});
          break;
        }
        case 'checkout_session':{
          const customer=byStep.get('customer_1')?.object_id;
          const price=byStep.get('price_1')?.object_id;
          if(!id(customer,'cus')||!id(price,'price'))
            bad('Verified TEST Checkout price and customer required');
          made=await s.checkout.sessions.create({
            mode:'payment',customer,payment_method_types:['card'],
            line_items:[{price,quantity:1}],
            success_url:'https://example.com/stripe-test-success',
            cancel_url:'https://example.com/stripe-test-cancel',
            client_reference_id:plan.runId,metadata,
            payment_intent_data:{metadata}
          },opts);
          break;
        }
        case 'invoice_item':{
          if(isInvoiceTerminalEvent(plan.type)){
            const customer=byStep.get('customer_1')?.object_id;
            const invoice=byStep.get('invoice_1')?.object_id;
            if(!id(customer,'cus')||!id(invoice,'in'))
              bad('Exact tracked TEST customer and draft invoice required');
            made=await s.invoiceItems.create({customer,invoice,amount:3600,
              currency:'usd',description:'Synthetic uncharged terminal TEST invoice',
              metadata},opts);break;
          }
          const customer=byStep.get('customer_1')?.object_id;
          const invoice=byStep.get('invoice_1')?.object_id;
          if(!id(customer,'cus')||!id(invoice,'in'))
            bad('Recorded TEST invoice and customer required before line');
          made=await s.invoiceItems.create({customer,invoice,amount:3600,
            currency:'usd',description:'Synthetic declined TEST invoice charge',
            metadata},opts);
          break;
        }
        case 'setup_intent':{
          made=await s.setupIntents.create({
            payment_method_types:['card'],usage:'off_session',metadata
          },opts);break;
        }
        case 'payment_method':{
          if(isPaymentMethodEvent(plan.type)){
            made=await s.paymentMethods.create({
              type:'card',card:{token:'tok_visa'},metadata
            },opts);
            break;
          }
          const customer=byStep.get('customer_1')?.object_id;
          if(!id(customer,'cus'))bad('Recorded TEST invoice customer required for declining card');
          const attached=await s.paymentMethods.attach('pm_card_chargeCustomerFail',
            {customer},opts);
          if(!id(attached?.id,'pm')||attached.object!=='payment_method'||
            attached.livemode!==false||ref(attached.customer)!==customer||
            attached.type!=='card')
            bad('Stripe did not attach the declining TEST card to exact customer');
          await s.paymentMethods.update(attached.id,{metadata},{
            idempotencyKey:rootKey+'_failure_payment_method_tag'});
          made=await s.paymentMethods.retrieve(attached.id);
          break;
        }
        case 'subscription':{
          const customer=byStep.get('customer_1')?.object_id;
          const price=byStep.get('price_1')?.object_id;
          if(!id(customer,'cus')||!id(price,'price'))
            bad('Verified TEST customer and recurring price required');
          made=await s.subscriptions.create({customer,items:[{price}],
            trial_period_days:7,collection_method:'charge_automatically',
            metadata},opts);break;
        }
        case 'invoice':{
          if(isInvoiceEvent(plan.type)||isInvoiceFailureEvent(plan.type)||
            isInvoiceTerminalEvent(plan.type)){
            const customer=byStep.get('customer_1')?.object_id;
            if(!id(customer,'cus'))
              bad('TEST event invoice requires verified synthetic customer');
            made=await s.invoices.create({customer,currency:'usd',
              auto_advance:false,
              collection_method:isInvoiceFailureEvent(plan.type)?
                'charge_automatically':'send_invoice',
              ...(isInvoiceFailureEvent(plan.type)?{}:{days_until_due:30}),
              pending_invoice_items_behavior:'exclude',metadata},opts);
            break;
          }
          const subscriptionId=byStep.get('subscription_1')?.object_id;
          const customerId=byStep.get('customer_1')?.object_id;
          if(!id(subscriptionId,'sub')||!id(customerId,'cus'))
            bad('Recorded TEST trial required before invoice read');
          const sub=await s.subscriptions.retrieve(subscriptionId);
          verifySubscriptionObject(plan,sub,byStep);
          made=await verifyTrialInvoice(s,sub,plan,customerId,rootKey);
          break;
        }
        default:bad('Unsupported TEST event action');
      }
      if(made?.object!==kind[step.type]||!id(made.id,prefix[step.type])||
        made.livemode!==false)
        bad('Stripe did not acknowledge expected TEST event source object');
      resourceId=made.id;
    }
    const after=await read(s,step.type,resourceId);
    verifyFixture(plan,step,after,byStep);
    if(!recorded){
      if(!(await db.recordDevRunObject({account,id:plan.runId,
        stepName:step.name,objectType:step.type,objectId:resourceId})))
        throw Error('Created TEST provider object could not be durably recorded');
      byStep.set(step.name,{step_name:step.name,object_type:step.type,
        object_id:resourceId,cleaned:false});
    }
    if(isInvoiceTerminalEvent(plan.type)&&step.type==='invoice_item'){
      await ensureTerminalInvoiceEvent(s,plan,byStep,rootKey);
    }
    if(isSetupIntentEvent(plan.type)&&step.type==='setup_intent'){
      const owned=await s.setupIntents.retrieve(resourceId);
      verifySetupIntent(plan,owned);
      await ensureSetupIntentEvent(s,plan,owned,rootKey);
    }
    if(isPaymentMethodEvent(plan.type)&&step.type==='payment_method'){
      await ensurePaymentMethodEvent(s,plan,byStep,rootKey);
    }
    if(isInvoiceFailureEvent(plan.type)&&step.type==='payment_method'){
      await ensureFailedInvoicePayment(s,plan,byStep,rootKey);
      const afterAttempt=await s.invoices.retrieve(
        byStep.get('invoice_1')?.object_id);
      verifyFailedInvoiceSource(plan,afterAttempt,byStep,true);
    }
    if(isFailedPaymentEvent(plan.type)&&step.type==='payment_intent'){
      await ensureFailedPayment(s,plan,after,
        byStep.get('customer_1')?.object_id,rootKey);
      const failed=await read(s,step.type,resourceId);
      verifyFailedPayment(plan,failed,byStep.get('customer_1')?.object_id,true);
    }
    if(isInvoiceEvent(plan.type)&&step.type==='invoice'){
      await mutateInvoiceForEvent(s,plan,after,rootKey);
      const updated=await read(s,step.type,resourceId);
      verifyInvoiceFixture(plan,updated,byStep);
      ensureInvoiceMutation(plan,updated);
    }
    if(requiresTriggerMutation(plan,step)){
      // Every object ID is durably recorded and independently verified BEFORE
      // the next mutation; repeat actions reuse stable Stripe idempotency.
      await mutateEventSource(s,plan,step,after,rootKey);
      const changed=await read(s,step.type,resourceId);
      verifyFixture(plan,step,changed,byStep);
      if(!assertMutatedEvent(plan,changed))
        bad('Stripe TEST mutation has not independently reached its target state');
    }
  }
  await cancelTrialSubscription(s,plan,byStep,rootKey);
  const target=isCheckoutEvent(plan.type)?
    plan.steps.find(step=>step.type==='checkout_session'):
    isSubscriptionEvent(plan.type)?
    plan.steps.find(step=>step.type==='subscription'):
    (isInvoiceFailureEvent(plan.type)||isInvoiceTerminalEvent(plan.type))?
    plan.steps.find(step=>step.type==='invoice'):plan.steps.at(-2);
  const targetId=byStep.get(target.name)?.object_id;
  const customer=byStep.get('customer_1')?.object_id;
  if(!id(targetId,prefix[target.type]))bad('No verified TEST event source exists');
  const signature={id:targetId,type:target.type,customer,
    ...(isCheckoutEvent(plan.type)?{
      paymentIntent:byStep.get('payment_intent_1')?.object_id}:{}),
    ...(isDisputeEvent(plan.type)?{
      charge:byStep.get('charge_1')?.object_id,
      paymentIntent:byStep.get('payment_intent_1')?.object_id}:{}),
    ...(isSubscriptionEvent(plan.type)?{
      price:byStep.get('price_1')?.object_id}:{})};
  const old=byStep.get('event_1');
  if(old&&(old.object_type!=='event'||old.cleaned!==false||
    !id(old.object_id,'evt')))
    bad('TEST event ledger has inconsistent identity');
  // If the exact event ID is already durably tracked, retrieve it directly;
  // a retained event may have fallen outside the recent bounded event list.
  let eventId;
  if(old){
    const previous=await s.events.retrieve(old.object_id);
    if(!matchingEvent(previous,plan,account,signature))
      bad('Previously tracked TEST event no longer verifies');
    eventId=old.object_id;
  }else eventId=await findGeneratedEvent(s,plan,account,signature);
  if(!eventId)return db.getDevRun({account,requestKey:run.request_key});
  if(old&&old.object_id!==eventId)
    bad('Previously recorded TEST event identity unexpectedly changed');
  if(!old){
    if(!(await db.recordDevRunObject({account,id:plan.runId,
      stepName:'event_1',objectType:'event',objectId:eventId})))
      throw Error('Verified TEST provider event could not be durably recorded');
  }
  if(!(await db.completeDevRun({account,id:plan.runId,
    expectedSteps:plan.expectedSteps})))
    throw Error('TEST event ledger not independently complete');
  return db.getDevRun({account,requestKey:run.request_key});
}

// Original-Event recovery for a RUNNING/UNCERTAIN native TEST trigger.
// Requires the complete immutable source row set. A provider verified Event
// does not complete the SQL run, undo cleanup, or authorize replay/mutations.
export async function inspectIncompleteOriginalEvent({plan,rows,account,stripe:s}){
  const unknown=(reason)=>({verification:'provider_unverified',reason,
    ledgerCompletionChanged:false});
  if(!plan||!id(account,'acct')||!Array.isArray(rows)||
    rows.length>plan.expectedSteps||!Array.isArray(plan.steps))
    return unknown('incomplete_provenance');
  const byStep=new Map(rows.map(row=>[row.step_name,row]));
  if(byStep.size!==rows.length||!plan.steps.slice(0,-1).every(step=>{
    const row=byStep.get(step.name);
    return row&&row.object_type===step.type&&
      id(row.object_id,prefix[step.type])&&typeof row.cleaned==='boolean';
  }))return unknown('missing_recorded_source');
  const eventRow=byStep.get('event_1');
  if(eventRow&&(eventRow.object_type!=='event'||
    !id(eventRow.object_id,'evt')||eventRow.cleaned!==false))
    return unknown('invalid_recorded_event');
  const targetStep=isCheckoutEvent(plan.type)?
    plan.steps.find(x=>x.type==='checkout_session'):
    isSubscriptionEvent(plan.type)?
    plan.steps.find(x=>x.type==='subscription'):
    (isInvoiceFailureEvent(plan.type)||isInvoiceTerminalEvent(plan.type))?
    plan.steps.find(x=>x.type==='invoice'):plan.steps.at(-2);
  const target=byStep.get(targetStep?.name);
  if(!target)return unknown('missing_recorded_source');
  const source={id:target.object_id,type:targetStep.type,
    customer:byStep.get('customer_1')?.object_id,
    ...(isCheckoutEvent(plan.type)?{
      paymentIntent:byStep.get('payment_intent_1')?.object_id}:{}),
    ...(isDisputeEvent(plan.type)?{
      charge:byStep.get('charge_1')?.object_id,
      paymentIntent:byStep.get('payment_intent_1')?.object_id}:{}),
    ...(isSubscriptionEvent(plan.type)?{
      price:byStep.get('price_1')?.object_id}:{})};
  try{
    let eventId;
    if(eventRow){
      const event=await s.events.retrieve(eventRow.object_id);
      if(!matchingEvent(event,plan,account,source))
        return unknown('original_event_mismatch');
      eventId=eventRow.object_id;
    }else eventId=await findGeneratedEvent(s,plan,account,source);
    if(!eventId)return unknown('original_event_not_verified');
    return {verification:'provider_verified',type:plan.type,eventId,
      sourceType:targetStep.type,ledgerCompletionChanged:false,
      note:'Immutable original Event independently retrieved with exact TEST source. The unfinished run remains unfinished; no event receipt has been added to its ledger, no signed webhook or cleanup proven.'};
  }catch{return unknown('provider_read_unverified');}
}

/** Read an actual immutable Stripe Event by the exact account-scoped run.
 * Source objects can already be deleted/archived; the Event snapshot must still
 * independently match the approved original run and source IDs.
 */
export async function verifyRecordedTriggerRun(a,ctx,s){
  const account=ctx?.connection?.stripeAccount,db=ctx?.db;
  if(ctx?.connection?.mode!=='test'||!id(account,'acct'))
    bad('Select the original connected TEST Stripe account');
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).length!==1||!/^run_[a-f0-9]{24}$/.test(a.runId??''))
    bad('Exact TEST trigger run ID required');
  if(typeof db?.getDevRunById!=='function'||typeof db?.getDevRunObjects!=='function')
    bad('Durable account-scoped TEST event ledger unavailable');
  const run=await db.getDevRunById({account,id:a.runId});
  if(!run||run.stripe_account!==account||run.id!==a.runId||
    run.status!=='completed'||run.size!==1||
    typeof run.request_key!=='string')
    bad('No completed selected-account TEST trigger run');
  const type=triggerTypes.find(x=>'event-'+x.replaceAll('_','-').replaceAll('.','-')===
    run.scenario);
  if(!type)bad('Recorded TEST run is not a supported native event trigger');
  const plan=resolveTriggerPlan({type,requestKey:run.request_key},account,run);
  if(plan.runId!==run.id||plan.planDigest!==run.plan_digest||
    plan.scenario!==run.scenario)
    bad('TEST event run no longer matches its immutable approved plan');
  const rows=await db.getDevRunObjects({account,id:run.id});
  if(!Array.isArray(rows)||rows.length!==plan.expectedSteps)
    bad('Incomplete TEST event ledger cannot prove a Stripe Event');
  const byStep=new Map(rows.map(x=>[x.step_name,x]));
  if(byStep.size!==rows.length||!plan.steps.every(step=>{
    const row=byStep.get(step.name);
    return row&&row.object_type===step.type&&
      id(row.object_id,prefix[step.type])&&typeof row.cleaned==='boolean';
  }))bad('Tracked TEST event identities differ from the approved plan');
  const eventRow=byStep.get('event_1');
  if(eventRow.cleaned!==false)bad('Immutable Stripe Event must remain recorded');
  const targetStep=isCheckoutEvent(plan.type)?
    plan.steps.find(x=>x.type==='checkout_session'):
    isSubscriptionEvent(plan.type)?
    plan.steps.find(x=>x.type==='subscription'):
    isInvoiceFailureEvent(plan.type)?
    plan.steps.find(x=>x.type==='invoice'):plan.steps.at(-2);
  const targetRow=byStep.get(targetStep.name);
  if(!targetRow||!id(targetRow.object_id,prefix[targetStep.type]))
    bad('Recorded TEST trigger source is unavailable');
  const signature={id:targetRow.object_id,type:targetStep.type,
    customer:byStep.get('customer_1')?.object_id,
    ...(isCheckoutEvent(plan.type)?{
      paymentIntent:byStep.get('payment_intent_1')?.object_id}:{}),
    ...(isDisputeEvent(plan.type)?{
      charge:byStep.get('charge_1')?.object_id,
      paymentIntent:byStep.get('payment_intent_1')?.object_id}:{}),
    ...(isSubscriptionEvent(plan.type)?{
      price:byStep.get('price_1')?.object_id}:{})};
  const event=await s.events.retrieve(eventRow.object_id);
  if(!matchingEvent(event,plan,account,signature))
    bad('Independent Stripe Event retrieval did not match exact TEST provenance');
  return {runId:run.id,mode:'test',type:plan.type,providerVerified:true,
    eventId:eventRow.object_id,sourceType:targetStep.type,
    sourceId:targetRow.object_id,sourceCleaned:targetRow.cleaned,
    immutableEventRetained:true,webhookDeliveryVerified:false,
    note:'Exact original TEST Stripe Event independently retrieved and matched against approved run and original source. No claim about signed webhook delivery, current mutable object state or Dashboard review.'};
}
