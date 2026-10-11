// Account-scoped TEST scenario plans and durable, idempotent Stripe execution.
import {createHash} from 'node:crypto';
import {executeLateSubscription} from './late-subscription.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const seedScenarios=['catalog-starter','basic-store','subscription-trial',
  'subscription-canceled','subscription-active','subscription-past-due',
  'dispute-trigger','ach-awaiting-confirmation'];
function chooseScenario(a){
  if((!!a?.scenario)===(!!a?.description))
    throw new TypeError('Select one named TEST scenario OR a plain description');
  if(a.scenario!==undefined){
    if(!seedScenarios.includes(a.scenario))throw new TypeError('Unsupported TEST seed scenario');
    return a.scenario;
  }
  if(typeof a.description!=='string'||a.description.length<3||
    a.description.length>256)throw new TypeError('Bounded TEST scenario description required');
  const d=a.description.toLowerCase();
  if(/refund|marketplace|connect|settle|reconcile/.test(d))
    throw new TypeError('That scenario requires the next consent-aware TEST builder slice');
  if(/past.due|overdue|failed renewal/.test(d)){
    if(/ach|bank|refund|dispute|store|catalog/.test(d))
      throw new TypeError('Description is ambiguous; select one TEST scenario');
    return 'subscription-past-due';
  }
  if(/active subscription|paid subscription/.test(d)){
    if(/trial|cancel|dispute|ach|bank|store|catalog/.test(d))
      throw new TypeError('Description is ambiguous; select one TEST scenario');
    return 'subscription-active';
  }
  const matches=[
    [/dispute|chargeback/,'dispute-trigger'],
    [/ach|bank/,'ach-awaiting-confirmation'],
    [/cancel(?:led|ed|ation)?|ended subscription/,'subscription-canceled'],
    [/trial|subscription|renewal/,'subscription-trial'],
    [/store|one.time|sale|payment|charge/,'basic-store'],
    [/catalog|price|product|customer/,'catalog-starter']
  ].filter(([rx])=>rx.test(d));
  if(matches.length!==1)throw new TypeError('Description is ambiguous; choose a named TEST scenario');
  return matches[0][1];
}
export function planSeed(a,account){
  if(typeof account!=='string'||!/^acct_[A-Za-z0-9]+$/.test(account)||
    !Number.isInteger(a?.size)||a.size<1||a.size>5||
    typeof a.requestKey!=='string'||a.requestKey.length<1||
    a.requestKey.length>128)
    throw new TypeError('Choose size 1–5 and a stable TEST requestKey');
  const scenario=chooseScenario(a);
  const runId='run_'+sha(JSON.stringify([account,a.requestKey])).slice(0,24);
  if(scenario==='subscription-past-due'){
    if(!Number.isSafeInteger(a.frozenTime)||a.frozenTime<946684800||
      a.frozenTime+8*86400>4102444800)
      throw new TypeError('A stable bounded frozenTime is required for past-due clock simulation');
    const steps=[];
    for(let i=1;i<=a.size;i++){
      steps.push({name:'clock_'+i,type:'test_clock',frozenTime:a.frozenTime});
      steps.push({name:'product_'+i,type:'product',amountCents:3500+i*100});
      steps.push({name:'price_'+i,type:'price',amountCents:3500+i*100});
      steps.push({name:'customer_'+i,type:'customer',paymentMethod:'pm_card_chargeCustomerFail'});
      steps.push({name:'subscription_'+i,type:'subscription',state:'past_due'});
      steps.push({name:'trial_invoice_'+i,type:'invoice',amountCents:0});
      steps.push({name:'failed_invoice_'+i,type:'invoice',amountCents:3500+i*100});
    }
    return {runId,scenario,size:a.size,steps,frozenTime:a.frozenTime,
      planDigest:sha(JSON.stringify([steps,a.scenario??null,a.description??null])),
      expectedSteps:steps.length,amountCents:0};
  }
  if(a.frozenTime!==undefined)throw new TypeError('Only a clocked TEST scenario accepts frozenTime');
  const steps=[];
  for(let i=1;i<=a.size;i++){
    const amountCents=3500+i*100;
    steps.push({name:'product_'+i,type:'product',label:'RTC Test Product '+i,amountCents});
    steps.push({name:'price_'+i,type:'price',label:scenario==='catalog-starter'?
      'Monthly TEST price '+i:'RTC Test Price '+i,amountCents});
    steps.push({name:'customer_'+i,type:'customer',label:'RTC Test Customer '+i,
      ...(scenario==='subscription-active'?{paymentMethod:'pm_card_visa'}:{})});
    if(['basic-store','dispute-trigger','ach-awaiting-confirmation'].includes(scenario))
      steps.push({name:'payment_'+i,type:'payment_intent',amountCents,
        ...(scenario==='dispute-trigger'?{testMethod:'pm_card_createDispute'}:{}),
        ...(scenario==='ach-awaiting-confirmation'?{testMethod:'ach'}:{})});
    if(scenario.startsWith('subscription-'))
      steps.push({name:'subscription_'+i,type:'subscription',
        state:scenario==='subscription-trial'?'trialing':
          scenario==='subscription-canceled'?'canceled':'active',
        ...(scenario==='subscription-active'?{amountCents}:{})});
    if(scenario==='subscription-active')
      steps.push({name:'invoice_'+i,type:'invoice',amountCents});
  }
  return {runId,scenario,size:a.size,steps,
    // Preserve the V-1a plan hash for old named catalog-starter retries. Other
    // selectors are immutable too: changing a description must not change the
    // per-step Stripe idempotency identity of an incomplete run.
    planDigest:sha(JSON.stringify(a.scenario==='catalog-starter'?steps:
      [steps,a.scenario??null,a.description??null])),expectedSteps:steps.length,
    amountCents:steps.filter(x=>(x.type==='payment_intent'&&x.testMethod!=='ach')||
      (x.type==='subscription'&&x.state==='active'))
      .reduce((sum,x)=>sum+x.amountCents,0)};
}
export function seedDescription(p){
  if(p.scenario==='subscription-past-due')return 'TEST MODE. Create '+p.size+' RTC-owned test clocks, monthly subscriptions, '+
    'seven-day free trials and attached fail-on-charge TEST methods. Independently '+
    'record trial invoices; advance each clock eight days, then only complete run '+
    p.runId+' if Stripe confirms every past_due subscription and attempted unpaid '+
    'renewal invoice. Clock advance is asynchronous: repeat dev_seed with the same '+
    'requestKey after the clock is ready. Nothing is claimed settled, no LIVE or real money.';
  const counts={};
  for(const s of p.steps)counts[s.type]=(counts[s.type]??0)+1;
  const summary=Object.entries(counts).map(([k,v])=>v+' '+k).join(', ');
  return 'TEST MODE. Create exactly '+summary+' ('+p.expectedSteps+' records) for scenario '+p.scenario+
    ', run '+p.runId+'. Every Stripe object is tagged rtc_run, independently verified,'+
    ' and durably tracked for precise cleanup. '+(p.amountCents?
      'Synthetic incoming TEST card charges total $'+(p.amountCents/100).toFixed(2)+' USD. ':'')+
    (p.scenario==='subscription-active'?
      'An immediately paid TEST invoice and active subscription must be verified. ':
      p.scenario.startsWith('subscription-')?
        'Subscriptions begin with free trials; no immediate invoice charge. ':'')+
    (p.scenario==='dispute-trigger'?
      'Uses Stripe test dispute card; a later dispute event is NOT yet verified. ':'')+
    (p.scenario==='ach-awaiting-confirmation'?
      'Creates an unconfirmed ACH-capable intent, NOT a settled bank debit. ':'')+
    'No real funds, automatic refunds, verified dispute outcome, ACH settlement or LIVE operations.';
}
const idPatterns={
  product:/^prod_[A-Za-z0-9]{2,100}$/,
  price:/^price_[A-Za-z0-9]{2,100}$/,
  customer:/^cus_[A-Za-z0-9]{2,100}$/,
  payment_intent:/^pi_[A-Za-z0-9]{2,100}$/,
  subscription:/^sub_[A-Za-z0-9]{2,100}$/,
  invoice:/^in_[A-Za-z0-9]{2,100}$/
};
const ref=x=>typeof x==='string'?x:x?.id;
async function retrieve(s,type,id){
  switch(type){
    case 'product':return s.products.retrieve(id);
    case 'price':return s.prices.retrieve(id);
    case 'customer':return s.customers.retrieve(id);
    case 'payment_intent':return s.paymentIntents.retrieve(id);
    case 'subscription':return s.subscriptions.retrieve(id);
    case 'invoice':return s.invoices.retrieve(id);
    default:throw new TypeError('Unknown tracked TEST object type');
  }
}
function verified(x,step,runId,dependencies){
  if(x?.metadata?.rtc_run!==runId||!idPatterns[step.type].test(x?.id??''))
    throw new TypeError('Independent Stripe read-back did not verify rtc_run provenance');
  switch(step.type){
    case 'customer':
      if(step.paymentMethod&&ref(x.invoice_settings?.default_payment_method)!==
        step.paymentMethod)
        throw new TypeError('TEST customer default payment method was not attached');
      break;
    case 'price':
      if(x.currency!=='usd'||x.unit_amount!==step.amountCents||
        ref(x.product)!==dependencies.productId||
        (dependencies.recurring?x.recurring?.interval!=='month':x.type!=='one_time'))
        throw new TypeError('Stripe TEST price amount/product/type differs from plan');
      break;
    case 'payment_intent':
      if(x.currency!=='usd'||x.amount!==step.amountCents||
        ref(x.customer)!==dependencies.customerId)
        throw new TypeError('Stripe TEST payment amount/customer mismatch');
      if(step.testMethod==='ach'){
        if(!['requires_confirmation','requires_payment_method','requires_action'].includes(x.status)||
          x.amount_received!==0||!x.payment_method_types?.includes('us_bank_account'))
          throw new TypeError('ACH setup was not verified as unconfirmed and unsettled');
      }else if(x.status!=='succeeded'||x.amount_received!==step.amountCents)
        throw new TypeError('TEST card charge did not independently succeed for full amount');
      break;
    case 'invoice':
      if(x.currency!=='usd'||x.status!=='paid'||
        x.amount_paid!==step.amountCents||
        ref(x.customer)!==dependencies.customerId||x.livemode===true)
        throw new TypeError('Active TEST invoice was not fully paid by the right customer');
      break;
    case 'subscription':
      if(x.status!==step.state||ref(x.customer)!==dependencies.customerId||
        !Array.isArray(x.items?.data)||
        !x.items.data.some(item=>ref(item.price)===dependencies.priceId))
        throw new TypeError('Stripe TEST subscription status/customer/price read-back mismatch');
      break;
  }
}
export async function executeSeed({plan,run,stripe,db,account,rootKey}){
  if(plan.scenario==='subscription-past-due')
    return executeLateSubscription({plan,run,stripe,db,account,rootKey});
  if(run.status==='completed')return run;
  if(run.status!=='running'||Date.now()-new Date(run.created_at).getTime()>43200000)
    throw new TypeError('Stale/uncertain TEST seed run cannot safely resume');
  const existing=await db.getDevRunObjects({account,id:plan.runId});
  const byStep=new Map(existing.map(x=>[x.step_name,x]));
  for(const step of plan.steps){
    const index=Number(step.name.split('_').at(-1));
    const productId=byStep.get('product_'+index)?.object_id;
    const priceId=byStep.get('price_'+index)?.object_id;
    const customerId=byStep.get('customer_'+index)?.object_id;
    const subscriptionId=byStep.get('subscription_'+index)?.object_id;
    const dependencies={productId,priceId,customerId,
      recurring:!['basic-store','dispute-trigger','ach-awaiting-confirmation'].includes(plan.scenario)};
    const prior=byStep.get(step.name);
    if(prior){
      if(prior.object_type!==step.type||!idPatterns[step.type].test(prior.object_id))
        throw new TypeError('Recorded TEST object has an inconsistent identity');
      const old=await retrieve(stripe,step.type,prior.object_id);
      verified(old,step,plan.runId,dependencies);
      continue;
    }
    const opts={idempotencyKey:rootKey+'_'+step.name};
    const metadata={rtc_run:plan.runId};
    let created;
    switch(step.type){
      case 'product':
        created=await stripe.products.create({name:step.label,metadata},opts);break;
      case 'price':
        if(!productId)throw new TypeError('Recorded TEST product must precede price');
        created=await stripe.prices.create({product:productId,currency:'usd',
          unit_amount:step.amountCents,
          ...(['basic-store','dispute-trigger','ach-awaiting-confirmation'].includes(plan.scenario)?
            {}:{recurring:{interval:'month'}}),
          metadata},opts);break;
      case 'customer':
        created=await stripe.customers.create({name:step.label,
          email:'rtc-test+'+plan.runId+'-'+index+'@example.test',metadata,
          ...(step.paymentMethod?{
            payment_method:step.paymentMethod,
            invoice_settings:{default_payment_method:step.paymentMethod}
          }:{})},opts);break;
      case 'payment_intent':
        if(!customerId||!priceId)throw new TypeError('Verified customer/price required for TEST charge');
        created=await stripe.paymentIntents.create({
          customer:customerId,amount:step.amountCents,currency:'usd',
          ...(step.testMethod==='ach'?{
            payment_method:'pm_usBankAccount',payment_method_types:['us_bank_account'],
            confirm:false,description:'Unconfirmed TEST ACH-capable setup, no bank debit'
          }:{payment_method:step.testMethod??'pm_card_visa',confirm:true,
            description:step.testMethod==='pm_card_createDispute'?
              'TEST card selected for later dispute event':'Synthetic tracked TEST store payment'}),
          metadata
        },opts);break;
      case 'subscription':
        if(!customerId||!priceId)throw new TypeError('Verified customer/price required for TEST subscription');
        created=await stripe.subscriptions.create({
          customer:customerId,items:[{price:priceId}],
          collection_method:'charge_automatically',
          billing_mode:{type:'flexible'},payment_behavior:'error_if_incomplete',
          proration_behavior:'none',
          ...(step.state==='active'?{}:{trial_period_days:7}),metadata
        },opts);break;
      case 'invoice':{
        if(!subscriptionId||!customerId)
          throw new TypeError('Verified subscription and customer must precede paid invoice');
        const sub=await stripe.subscriptions.retrieve(subscriptionId);
        if(sub?.status!=='active'||sub?.metadata?.rtc_run!==plan.runId||
          ref(sub.customer)!==customerId)
          throw new TypeError('Active run-owned subscription has not been verified');
        const invoiceId=ref(sub.latest_invoice);
        if(!idPatterns.invoice.test(invoiceId??''))
          throw new TypeError('Active TEST subscription has no provider invoice');
        const invoice=await stripe.invoices.retrieve(invoiceId);
        if(invoice?.object!=='invoice'||invoice.status!=='paid'||
          invoice.currency!=='usd'||invoice.amount_paid!==step.amountCents||
          ref(invoice.customer)!==customerId)
          throw new TypeError('Paid first invoice is not linked to verified TEST customer');
        // The subscription creates this invoice automatically. Tag that exact
        // linked provider invoice before recording it in the durable ledger.
        created=await stripe.invoices.update(invoiceId,{metadata},opts);break;
      }
      default:throw new TypeError('Unsupported provider creation step');
    }
    if(!created||!idPatterns[step.type].test(created.id??'')||
      created.object!==step.type)
      throw new TypeError('Stripe did not acknowledge the correct TEST object');
    if(step.type==='subscription'&&step.state==='canceled'){
      const state=await retrieve(stripe,'subscription',created.id);
      if(state.status==='trialing'){
        verified(state,{...step,state:'trialing'},plan.runId,dependencies);
        await stripe.subscriptions.cancel(created.id,{invoice_now:false,prorate:false},{
          idempotencyKey:rootKey+'_'+step.name+'_cancel'});
      }else if(state.status!=='canceled')
        throw new TypeError('Unexpected TEST subscription state before planned cancellation');
    }
    const after=await retrieve(stripe,step.type,created.id);
    verified(after,step,plan.runId,dependencies);
    if(!(await db.recordDevRunObject({account,id:plan.runId,
      stepName:step.name,objectType:step.type,objectId:created.id})))
      throw new Error('Stripe TEST object not durably tracked; outcome uncertain');
    byStep.set(step.name,{step_name:step.name,object_type:step.type,
      object_id:created.id});
  }
  if(!(await db.completeDevRun({account,id:plan.runId,
    expectedSteps:plan.expectedSteps})))
    throw new Error('Incomplete TEST provider object ledger');
  return db.getDevRun({account,requestKey:run.request_key});
}
