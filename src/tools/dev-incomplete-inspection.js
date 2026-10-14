// V-3 incomplete TEST trigger recovery inspection. This reader never resumes,
// cleans, or creates Stripe objects and does not infer that an Event was absent.
import {planTrigger,triggerTypes,inspectIncompleteOriginalEvent} from '../dev/triggers.js';
import {APP_METADATA_KEYS} from './app-guard.js';
import {allProfiles,client,reply} from './billing-shared.js';
import {gone} from './write.js';

const runIdPattern=/^run_[a-f0-9]{24}$/;
const accountPattern=/^acct_[A-Za-z0-9]{2,100}$/;
const identities={
  customer:['cus','customer'],product:['prod','product'],
  price:['price','price'],subscription:['sub','subscription'],
  invoice:['in','invoice'],payment_intent:['pi','payment_intent'],
  invoice_item:['ii','invoiceitem'],checkout_session:['cs_test','checkout.session'],
  charge:['ch','charge'],dispute:['du','dispute'],event:['evt','event']
};
const read={
  customer:(s,id)=>s.customers.retrieve(id),
  product:(s,id)=>s.products.retrieve(id),
  price:(s,id)=>s.prices.retrieve(id),
  subscription:(s,id)=>s.subscriptions.retrieve(id),
  invoice:(s,id)=>s.invoices.retrieve(id),
  payment_intent:(s,id)=>s.paymentIntents.retrieve(id),
  invoice_item:(s,id)=>s.invoiceItems.retrieve(id),
  checkout_session:(s,id)=>s.checkout.sessions.retrieve(id),
  charge:(s,id)=>s.charges.retrieve(id),
  dispute:(s,id)=>s.disputes.retrieve(id)
};
const ref=x=>typeof x==='string'?x:x?.id;
const own=(o,row,run,byStep)=>{
  const info=identities[row.object_type];
  if(!info||o?.id!==row.object_id||
    (o.object!==info[1]&&!(row.object_type==='customer'&&o.deleted===true))||
    (o.livemode!==false&&!(row.object_type==='customer'&&o.deleted===true))||
    Object.keys(o.metadata??{}).some(k=>APP_METADATA_KEYS.includes(k)))
    return false;
  if(row.object_type==='customer'&&o.deleted===true)return true;
  if(row.object_type==='charge')return ref(o.payment_intent)===
    byStep.get('payment_intent_1')?.object_id&&
    ref(o.customer)===byStep.get('customer_1')?.object_id&&
    o.amount===3600&&o.currency==='usd';
  if(row.object_type==='dispute')return ref(o.charge)===
    byStep.get('charge_1')?.object_id&&o.amount===3600&&o.currency==='usd';
  if(o.metadata?.rtc_run!==run.id)return false;
  if(row.object_type==='price')
    return ref(o.product)===byStep.get('product_1')?.object_id;
  if(['subscription','invoice','payment_intent','invoice_item',
    'checkout_session'].includes(row.object_type)&&
    ref(o.customer)!==byStep.get('customer_1')?.object_id)return false;
  if(row.object_type==='invoice_item')
    return ref(o.invoice)===byStep.get('invoice_1')?.object_id;
  if(row.object_type==='subscription')
    return Array.isArray(o.items?.data)&&o.items.data.some(item=>
      ref(item.price)===byStep.get('price_1')?.object_id);
  return true;
};
function safeState(type,o){
  if(type==='customer')return o.deleted===true?'deleted':
    o.deleted!==true?'present':null;
  if(['product','price'].includes(type))return o.active===true?'active':
    o.active===false?'archived':null;
  if(type==='subscription')
    return ['trialing','active','past_due','unpaid','incomplete',
      'incomplete_expired','canceled','paused'].includes(o.status)?o.status:null;
  if(type==='invoice')
    return ['draft','open','paid','void','uncollectible'].includes(o.status)?o.status:null;
  if(type==='payment_intent')
    return ['requires_payment_method','requires_confirmation','requires_action',
      'processing','requires_capture','canceled','succeeded'].includes(o.status)?
      o.status:null;
  if(type==='checkout_session')
    return ['open','expired','complete'].includes(o.status)?o.status:null;
  if(['charge','dispute','invoice_item'].includes(type))
    return 'financial_evidence_retained';
  return null;
}
// Strictly bounded, non-PII indicators for the four provider-real trigger
// types that can remain unfinished after a declined attempt or async event.
// These observations NEVER imply an Event, cleanup success, or retry authority.
const flag=x=>typeof x==='boolean'?(x?'yes':'no'):'unknown';
function safeIndicators(type,o,byStep){
  if(type==='payment_intent')return {
    zeroAmountReceived:Number.isSafeInteger(o.amount_received)?
      flag(o.amount_received===0):'unknown',
    declineObserved:o.status==='requires_payment_method'&&
      o.last_payment_error?.code==='card_declined'?'yes':'no'
  };
  if(type==='invoice')return {
    paymentAttempted:flag(o.attempted),
    attemptCount:Number.isSafeInteger(o.attempt_count)&&
      o.attempt_count>=0&&o.attempt_count<=10000?o.attempt_count:null,
    zeroAmountPaid:Number.isSafeInteger(o.amount_paid)?
      flag(o.amount_paid===0):'unknown',
    positiveAmountRemaining:Number.isSafeInteger(o.amount_remaining)?
      flag(o.amount_remaining>0):'unknown',
    automaticCollection:flag(o.collection_method==='charge_automatically'?
      true:o.collection_method==='send_invoice'?false:null)
  };
  if(type==='charge')return {disputed:flag(o.disputed)};
  if(type==='subscription'){
    const linked=ref(o.latest_invoice),tracked=byStep.get('invoice_1')?.object_id;
    return {initialInvoice:typeof linked!=='string'?'not_readable':
      !tracked?'not_recorded':linked===tracked?'linked':'mismatch'};
  }
  return null;
}
export const tools=[{
  name:'dev_inspect_incomplete_run',area:'developer',writes:false,
  profiles:allProfiles,annotations:{readOnlyHint:true},
  description:'Independently inspect bounded run-owned Stripe TEST sources on an unfinished trigger, without writes or Event-completion claims.',
  inputSchema:{type:'object',properties:{
    runId:{type:'string',pattern:'^run_[a-f0-9]{24}$'},
    includeOriginalEvent:{type:'boolean',
      description:'Recheck the exact native original TEST Event by recorded source without mutation.'}
  },required:['runId'],additionalProperties:false}
}];
export const handlers={
  async dev_inspect_incomplete_run(a,ctx){
    const account=ctx?.connection?.stripeAccount;
    if(ctx?.connection?.mode!=='test'||!accountPattern.test(account??''))
      return gone('Select the original TEST account');
    if(!a||typeof a!=='object'||Array.isArray(a)||
      Object.keys(a).some(k=>!['runId','includeOriginalEvent'].includes(k))||
      (a.includeOriginalEvent!==undefined&&typeof a.includeOriginalEvent!=='boolean')||
      !runIdPattern.test(a.runId))
      return gone('Exact unfinished TEST run required');
    if(typeof ctx.db?.getDevRunById!=='function'||
      typeof ctx.db?.getDevRunObjects!=='function')
      return gone('Selected-account TEST ledger unavailable');
    const run=await ctx.db.getDevRunById({account,id:a.runId});
    if(!run||run.id!==a.runId||run.stripe_account!==account||
      !['running','uncertain'].includes(run.status)||run.size!==1||
      typeof run.request_key!=='string'||run.request_key.length<1||
      run.request_key.length>128)
      return gone('No unfinished selected-account TEST trigger run');
    const type=triggerTypes.find(t=>'event-'+t.replaceAll('_','-')
      .replaceAll('.','-')===run.scenario);
    if(!type)return gone('Not a supported native TEST trigger run');
    const plan=planTrigger({type,requestKey:run.request_key},account);
    if(plan.runId!==run.id||plan.planDigest!==run.plan_digest||
      plan.scenario!==run.scenario)
      return gone('Immutable TEST trigger plan differs from ledger');
    const rows=await ctx.db.getDevRunObjects({account,id:run.id});
    if(!Array.isArray(rows)||rows.length>plan.expectedSteps||
      rows.length>12)return gone('Bounded TEST run object ledger unavailable');
    const expected=new Map(plan.steps.map(s=>[s.name,s.type]));
    const byStep=new Map();
    for(const row of rows){
      const identity=identities[row.object_type];
      if(!identity||expected.get(row.step_name)!==row.object_type||
        byStep.has(row.step_name)||typeof row.cleaned!=='boolean'||
        typeof row.object_id!=='string'||!
        new RegExp('^'+identity[0]+'_[A-Za-z0-9]{2,100}$').test(row.object_id))
        return gone('Recorded TEST source identity or plan inconsistent');
      byStep.set(row.step_name,row);
    }
    const stripe=await client(ctx);
    const observations=[];
    for(const row of rows){
      let result={step:row.step_name,type:row.object_type,
        cleanedInLedger:row.cleaned,verification:'provider_unverified'};
      if(row.object_type!=='event'){
        try{
          const object=await read[row.object_type](stripe,row.object_id);
          if(own(object,row,run,byStep)){
            const state=safeState(row.object_type,object);
            if(state){
              const indicators=safeIndicators(row.object_type,object,byStep);
              result={...result,verification:'provider_verified',
                observedState:state,...(indicators?{indicators}:{})};
            }
          }
        }catch{
          // Unknown provider state (including 404) never proves deleted,
          // clean, retry-safe, or absent. Do not expose SDK error details.
        }
      }
      observations.push(result);
    }
    const verified=observations.filter(x=>x.verification==='provider_verified').length;
    const originalEvent=a.includeOriginalEvent===true?
      await inspectIncompleteOriginalEvent({plan,rows,account,stripe}):null;
    return reply({runId:run.id,mode:'test',scenario:run.scenario,
      runStatus:run.status,expectedSteps:plan.expectedSteps,
      recordedSteps:rows.length,verifiedCount:verified,
      unverifiedCount:rows.length-verified,
      missingSteps:plan.steps.filter(s=>!byStep.has(s.name)).map(s=>s.name),
      observations,...(originalEvent?{originalEvent}:{}),
      note:'Read-only snapshot for an unfinished TEST run. Missing ledger steps do not prove a Stripe Event did not occur. Reuse the original request key only through the guarded native trigger, or preview exact run-owned cleanup; never infer a provider mutation, signed webhook or safe retry from these observations.'});
  }
};
