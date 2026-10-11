// Account-scoped TEST scenario plans and durable, idempotent Stripe execution.
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const seedScenarios=['catalog-starter','basic-store','subscription-trial','subscription-canceled'];
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
  if(/refund|dispute|bank|ach|marketplace|connect|past.due/.test(d))
    throw new TypeError('That scenario requires the next consent-aware TEST builder slice');
  const matches=[
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
  const steps=[];
  for(let i=1;i<=a.size;i++){
    const amountCents=3500+i*100;
    steps.push({name:'product_'+i,type:'product',label:'RTC Test Product '+i,amountCents});
    steps.push({name:'price_'+i,type:'price',label:scenario==='catalog-starter'?
      'Monthly TEST price '+i:'RTC Test Price '+i,amountCents});
    steps.push({name:'customer_'+i,type:'customer',label:'RTC Test Customer '+i});
    if(scenario==='basic-store')
      steps.push({name:'payment_'+i,type:'payment_intent',amountCents});
    if(scenario.startsWith('subscription-'))
      steps.push({name:'subscription_'+i,type:'subscription',
        state:scenario==='subscription-trial'?'trialing':'canceled'});
  }
  return {runId,scenario,size:a.size,steps,
    // Preserve the V-1a plan hash for old named catalog-starter retries. Other
    // selectors are immutable too: changing a description must not change the
    // per-step Stripe idempotency identity of an incomplete run.
    planDigest:sha(JSON.stringify(a.scenario==='catalog-starter'?steps:
      [steps,a.scenario??null,a.description??null])),expectedSteps:steps.length,
    amountCents:steps.filter(x=>x.type==='payment_intent')
      .reduce((sum,x)=>sum+x.amountCents,0)};
}
export function seedDescription(p){
  const counts={};
  for(const s of p.steps)counts[s.type]=(counts[s.type]??0)+1;
  const summary=Object.entries(counts).map(([k,v])=>v+' '+k).join(', ');
  return 'TEST MODE. Create exactly '+summary+' ('+p.expectedSteps+' records) for scenario '+p.scenario+
    ', run '+p.runId+'. Every Stripe object is tagged rtc_run, independently verified,'+
    ' and durably tracked for precise cleanup. '+(p.amountCents?
      'Synthetic incoming TEST card charges total $'+(p.amountCents/100).toFixed(2)+' USD. ':'')+
    (p.scenario.startsWith('subscription-')?
      'Subscriptions begin with free trials; no immediate invoice charge. ':'')+
    'No real funds, automatic refund, dispute, ACH debit or LIVE operations.';
}
const idPatterns={
  product:/^prod_[A-Za-z0-9]{2,100}$/,
  price:/^price_[A-Za-z0-9]{2,100}$/,
  customer:/^cus_[A-Za-z0-9]{2,100}$/,
  payment_intent:/^pi_[A-Za-z0-9]{2,100}$/,
  subscription:/^sub_[A-Za-z0-9]{2,100}$/
};
const ref=x=>typeof x==='string'?x:x?.id;
async function retrieve(s,type,id){
  switch(type){
    case 'product':return s.products.retrieve(id);
    case 'price':return s.prices.retrieve(id);
    case 'customer':return s.customers.retrieve(id);
    case 'payment_intent':return s.paymentIntents.retrieve(id);
    case 'subscription':return s.subscriptions.retrieve(id);
    default:throw new TypeError('Unknown tracked TEST object type');
  }
}
function verified(x,step,runId,dependencies){
  if(x?.metadata?.rtc_run!==runId||!idPatterns[step.type].test(x?.id??''))
    throw new TypeError('Independent Stripe read-back did not verify rtc_run provenance');
  switch(step.type){
    case 'price':
      if(x.currency!=='usd'||x.unit_amount!==step.amountCents||
        ref(x.product)!==dependencies.productId||
        (dependencies.recurring?x.recurring?.interval!=='month':x.type!=='one_time'))
        throw new TypeError('Stripe TEST price amount/product/type differs from plan');
      break;
    case 'payment_intent':
      if(x.status!=='succeeded'||x.currency!=='usd'||
        x.amount!==step.amountCents||x.amount_received!==step.amountCents||
        ref(x.customer)!==dependencies.customerId)
        throw new TypeError('Stripe TEST card charge did not independently succeed for the planned customer/amount');
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
    const dependencies={productId,priceId,customerId,
      recurring:plan.scenario!=='basic-store'};
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
          ...(plan.scenario==='basic-store'?{}:{recurring:{interval:'month'}}),
          metadata},opts);break;
      case 'customer':
        created=await stripe.customers.create({name:step.label,
          email:'rtc-test+'+plan.runId+'-'+index+'@example.test',metadata},opts);break;
      case 'payment_intent':
        if(!customerId||!priceId)throw new TypeError('Verified customer/price required for TEST charge');
        created=await stripe.paymentIntents.create({
          customer:customerId,amount:step.amountCents,currency:'usd',
          payment_method:'pm_card_visa',confirm:true,metadata,
          description:'Synthetic tracked TEST store payment'
        },opts);break;
      case 'subscription':
        if(!customerId||!priceId)throw new TypeError('Verified customer/price required for TEST subscription');
        created=await stripe.subscriptions.create({
          customer:customerId,items:[{price:priceId}],
          collection_method:'charge_automatically',
          billing_mode:{type:'flexible'},payment_behavior:'error_if_incomplete',
          proration_behavior:'none',trial_period_days:7,metadata
        },opts);break;
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
