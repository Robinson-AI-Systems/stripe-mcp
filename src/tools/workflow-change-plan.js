// W-5: one exact TEST subscription plan change with two provider quotes.
// Uses ONLY original wrapped registry readers/writers and money-out owner gates.
import {reply,fail} from './billing-shared.js';
import {collect,nativeRead,deadline,expired,integer}
  from './workflow-read-common.js';
import {writable,check,customer,nativeWrite,readyStep,
  customerBillingFingerprint,verifiedSubscriptionFacts}
  from './workflow-customer-actions.js';

const id=p=>({type:'string',pattern:'^'+p+'_[A-Za-z0-9]{2,100}$'});
const fields={
  customerId:id('cus'),subscriptionId:id('sub'),itemId:id('si'),
  priceId:id('price'),quantity:{type:'integer',minimum:1,maximum:100000},
  effectiveAt:{type:'integer',minimum:946684800,maximum:4102444800},
  prorationBehavior:{type:'string',
    enum:['none','create_prorations','always_invoice']},
  outsideApp:{type:'boolean'},dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:96},
  previewToken:{type:'string',pattern:'^[a-f0-9]{64}$'}
};
export const tools=[{
  name:'workflow_change_plan',area:'workflows',profiles:['everyday','full'],
  description:'Compare exact TEST subscription price and quantity invoice previews, then confirm a guarded change.',
  writes:true,writeContract:'defineWrite-v1',safety:'$',moneyOut:true,
  moneySpec:'provider-derived',annotations:{destructiveHint:true},
  inputSchema:{type:'object',properties:fields,
    required:['customerId','effectiveAt','prorationBehavior'],
    additionalProperties:false}
}];
const allowed=new Set(['active','trialing','past_due','unpaid']);
const compactId=(v,p)=>typeof v==='string'&&
  new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(v);
const quoteSafe=(raw,label)=>{
  if(raw?.currency!=='usd'||!Number.isSafeInteger(raw.invoiceTotalCents)||
    Math.abs(raw.invoiceTotalCents)>100000000||
    (raw.amountDueCents!==null&&raw.amountDueCents!==undefined&&
      !Number.isSafeInteger(raw.amountDueCents))||
    raw.prorationLinesComplete!==true||
    !Array.isArray(raw.prorationLines)||raw.prorationLines.length>100||
    raw.prorationLines.some(l=>!integer(l.amountCents))||
    !['none','create_prorations','always_invoice'].includes(raw.prorationBehavior)||
    !Number.isSafeInteger(raw.effectiveAt))
    throw new TypeError(label+' Stripe provider quote is unavailable or incomplete');
  return {currency:'usd',invoiceTotalCents:raw.invoiceTotalCents,
    amountDueCents:raw.amountDueCents??null,
    effectiveAt:raw.effectiveAt,prorationBehavior:raw.prorationBehavior,
    prorationLines:raw.prorationLines.map(l=>({
      amountCents:l.amountCents,
      description:typeof l.description==='string'?l.description.slice(0,140):null
    }))};
};
const safeDetails=(sub,who)=>{
  if(sub.customer!==who||!allowed.has(sub.status)||sub.cancelAtPeriodEnd)
    throw new TypeError('Customer subscription is not mutable or is already ending');
  return verifiedSubscriptionFacts(sub);
};
async function resolveSubscription(a,ctx,end){
  if(a.subscriptionId){
    const s=await nativeRead('billing_get_subscription',
      {subscriptionId:a.subscriptionId},ctx);
    return {sub:s,facts:safeDetails(s,a.customerId)};
  }
  const all=await collect('billing_list_subscriptions',
    {customer:a.customerId,status:'all',limit:100},ctx,{end});
  if(!all.complete)throw new TypeError('Subscription discovery incomplete: '+all.reason);
  if(all.data.some(s=>s.customer!==a.customerId))
    throw new TypeError('Foreign customer in native subscription list');
  const candidates=all.data.filter(s=>allowed.has(s.status)&&
    !s.cancelAtPeriodEnd);
  if(candidates.length!==1)
    throw new TypeError(candidates.length?'Multiple subscriptions: exact subscriptionId required':
      'No mutable customer subscription found');
  const sub=candidates[0];
  return {sub,facts:safeDetails(sub,a.customerId)};
}
async function createPlan(a,ctx,end){
  await customer(a.customerId,ctx);
  if(!Number.isSafeInteger(a.effectiveAt)||
    a.effectiveAt<946684800||a.effectiveAt>4102444800||
    !['none','create_prorations','always_invoice'].includes(a.prorationBehavior))
    throw new TypeError('Explicit effectiveAt and prorationBehavior required');
  if(a.priceId===undefined&&a.quantity===undefined)
    throw new TypeError('Provide a new recurring priceId or item quantity');
  const {facts}=await resolveSubscription(a,ctx,end);
  if(facts.currency!=='usd')throw new TypeError('USD plan changes only');
  const item=a.itemId?facts.items.find(i=>i.id===a.itemId):
    facts.items.length===1?facts.items[0]:null;
  if(!item||!compactId(item.id,'si'))
    throw new TypeError('Multiple items: specify exact itemId or resolve missing item');
  if(item.currency!=='usd'||!integer(item.unitAmountCents)||
    item.unitAmountCents<0||item.billingScheme!=='per_unit'||
    item.usageType!=='licensed'||!item.recurring)
    throw new TypeError('Complete fixed recurring USD item required');
  if((a.priceId!==undefined&&a.priceId===item.price&&
    (a.quantity===undefined||a.quantity===item.quantity))||
    (a.priceId===undefined&&a.quantity===item.quantity))
    throw new TypeError('Plan price and quantity are unchanged');
  if(a.quantity!==undefined&&(!Number.isSafeInteger(a.quantity)||
    a.quantity<1||a.quantity>100000))
    throw new TypeError('Invalid desired quantity');
  if(a.priceId!==undefined&&!compactId(a.priceId,'price'))
    throw new TypeError('Exact new Stripe priceId required');
  const proposed={subscriptionId:facts.id,itemId:item.id,
    ...(a.priceId!==undefined?{priceId:a.priceId}:{}),
    ...(a.quantity!==undefined?{quantity:a.quantity}:{}),
    effectiveAt:a.effectiveAt,prorationBehavior:a.prorationBehavior,
    ...(a.outsideApp!==undefined?{outsideApp:a.outsideApp}:{})};
  const baselineArgs={subscriptionId:facts.id,itemId:item.id,
    quantity:item.quantity,effectiveAt:a.effectiveAt,
    prorationBehavior:a.prorationBehavior};
  const before=quoteSafe(await nativeRead('billing_preview_change',baselineArgs,ctx),'Current');
  const after=quoteSafe(await nativeRead('billing_preview_change',proposed,ctx),'Changed');
  if(before.effectiveAt!==after.effectiveAt||
    before.prorationBehavior!==after.prorationBehavior)
    throw new TypeError('Stripe previews are not comparable');
  const difference=after.invoiceTotalCents-before.invoiceTotalCents;
  if(!Number.isSafeInteger(difference)||Math.abs(difference)>200000000)
    throw new TypeError('Safe preview invoice difference unavailable');
  const child=await readyStep('billing_change_plan',proposed,ctx);
  if(expired(end))throw new TypeError('Plan change exceeded the 50-second budget');
  return {
    facts:{customerId:a.customerId,subscription:facts,
      itemId:item.id,selectedPrice:item.price,selectedQuantity:item.quantity,
      proposed:proposed,baselineQuote:before,changedQuote:after,differenceCents:difference},
    child
  };
}
async function execute(a,ctx,plan,end){
  const token=customerBillingFingerprint(ctx.connection.stripeAccount,
    'change_plan',plan.facts,[plan.child]);
  const base={kind:'change_plan',account:ctx.connection.stripeAccount,mode:'test',
    previewToken:token,complete:true,customerId:plan.facts.customerId,
    subscriptionId:plan.facts.subscription.id,itemId:plan.facts.itemId,
    currentPriceId:plan.facts.selectedPrice,
    currentQuantity:plan.facts.selectedQuantity,
    requestedPriceId:plan.facts.proposed.priceId??plan.facts.selectedPrice,
    requestedQuantity:plan.facts.proposed.quantity??plan.facts.selectedQuantity,
    baselineInvoiceQuote:plan.facts.baselineQuote,
    changedInvoiceQuote:plan.facts.changedQuote,
    quotedInvoiceDifferenceCents:plan.facts.differenceCents,
    currency:'usd',
    nativePreview:plan.child.preview,
    note:'Both totals are actual original Stripe TEST invoice previews, not guaranteed final charges. Any credit still requires the independent owner money-out grant on the native billing change.'};
  if(a.confirm!==true)return {...base,done:false,needsConfirmation:true};
  if(token!==a.previewToken)throw new TypeError('Plan or Stripe quote changed; preview again');
  if(expired(end))
    return {...base,done:false,confirmed:false,
      warning:'Quote budget expired before native write; request new preview'};
  const args={...plan.child.args,confirm:true,
    requestKey:a.requestKey+':plan'};
  try{
    const result=await nativeWrite('billing_change_plan',args,ctx);
    const receipt={tool:'billing_change_plan',target:plan.facts.subscription.id,
      confirmed:result.value.done===true&&result.value.confirmed===true,
      ...(typeof result.value.idempotencyKey==='string'?
        {idempotencyKey:result.value.idempotencyKey.slice(0,140)}:{})};
    if(result.isError||!receipt.confirmed)
      return {...base,done:false,confirmed:false,failedStep:receipt,
        warning:'Native guarded plan change denied or uncertain: inspect original audit before retry'};
    return {...base,done:true,confirmed:true,completedSteps:[receipt]};
  }catch{
    return {...base,done:false,confirmed:false,
      failedStep:{tool:'billing_change_plan',target:plan.facts.subscription.id,
        confirmed:false},
      warning:'Original native provider/audit outcome uncertain; do not retry automatically'};
  }
}
async function run(a,ctx){
  writable(ctx);check(a,fields,'change_plan');
  const end=deadline(),plan=await createPlan(a,ctx,end);
  return execute(a,ctx,plan,end);
}
export const handlers={
  workflow_change_plan:async(a,ctx)=>{
    try{return reply(await run(a,ctx));}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
