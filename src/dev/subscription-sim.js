// V-5b: original TEST provider objects on an isolated tracked subscription clock.
// Reuse the existing durable per-step dev run ledger and precise V-2 cleanup.
import {createHash} from 'node:crypto';
import {ref} from '../tools/billing-shared.js';

const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const assert=(ok,message)=>{if(!ok)throw new TypeError(message);};
const matches=(x,p)=>typeof x==='string'&&
  new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(x);
const cards=['pm_card_visa','pm_card_chargeCustomerFail'];
const types=['test_clock','product','price','customer','subscription'];
const names=['clock_1','product_1','price_1','customer_1','subscription_1'];
export const simulationSteps=Object.freeze(names.map((stepName,i)=>({
  stepName,objectType:types[i]
})));
export function planSubscriptionSimulation(args,account){
  assert(matches(account,'acct')&&args&&typeof args==='object'&&
    !Array.isArray(args),'Selected Stripe account and plan are required');
  const allowed=['months','amountCents','card','frozenTime','requestKey','dryRun','confirm'];
  assert(Object.keys(args).every(k=>allowed.includes(k))&&
    typeof args.requestKey==='string'&&args.requestKey.length>=1&&
    args.requestKey.length<=128,'Exact retry key and supported arguments required');
  assert(Number.isInteger(args.months)&&args.months>=1&&args.months<=3,
    'Simulation duration must be 1–3 monthly cycles');
  assert(Number.isSafeInteger(args.amountCents)&&args.amountCents>=100&&
    args.amountCents<=50000,'Synthetic monthly TEST USD price must be 100–50000 cents');
  assert(cards.includes(args.card),'Select a supported synthetic TEST card');
  assert(Number.isSafeInteger(args.frozenTime)&&args.frozenTime>=946684800&&
    args.frozenTime<=4102444800-100*86400,
    'Valid bounded initial frozen TEST time is required');
  const runId='run_'+digest([account,args.requestKey]).slice(0,24);
  const planDigest=digest([runId,args.months,args.amountCents,args.card,args.frozenTime]);
  return {account,runId,planDigest,months:args.months,
    amountCents:args.amountCents,card:args.card,frozenTime:args.frozenTime,
    requestKey:args.requestKey,scenario:'subscription-simulation',steps:simulationSteps};
}
const fakeName=(runId)=>'RTC DEV RUN '+runId+' 1';
function verifyStep(step,x,p,rows){
  const id=x?.id;
  assert(matches(id,{test_clock:'clock',product:'prod',price:'price',
    customer:'cus',subscription:'sub'}[step.objectType])&&x.livemode===false,
  'Provider returned an unverified TEST object');
  const value=Object.fromEntries(rows.map(r=>[r.step_name,r.object_id]));
  if(step.objectType==='test_clock'){
    assert(x.object==='test_helpers.test_clock'&&
      x.name===fakeName(p.runId)&&x.frozen_time===p.frozenTime&&
      x.status==='ready','Provider TEST clock is not ready or its identity changed');
    return;
  }
  const type=step.objectType;
  assert(x.object===type&&x.metadata?.rtc_run===p.runId,
    'Stripe TEST object missing exact run provenance');
  if(type==='price')assert(x.currency==='usd'&&x.unit_amount===p.amountCents&&
    ref(x.product)===value.product_1&&x.type==='recurring'&&
    x.recurring?.interval==='month'&&x.recurring.interval_count===1,
    'Monthly Stripe TEST price differs from approved plan');
  if(type==='customer')assert(ref(x.test_clock)===value.clock_1&&
    ref(x.invoice_settings?.default_payment_method)===p.card,
    'Stripe customer clock or TEST payment method differs');
  if(type==='subscription')assert(ref(x.customer)===value.customer_1&&
    ref(x.test_clock)===value.clock_1&&x.status==='trialing'&&
    x.collection_method==='charge_automatically'&&
    Array.isArray(x.items?.data)&&x.items.has_more===false&&
    x.items.data.some(i=>ref(i.price)===value.price_1)&&
    Number.isSafeInteger(x.trial_end)&&x.trial_end>p.frozenTime,
    'Stripe subscription is not an isolated, clocked TEST trial');
}
async function retrieve(s,kind,id){
  switch(kind){
    case 'test_clock':return s.testHelpers.testClocks.retrieve(id);
    case 'product':return s.products.retrieve(id);
    case 'price':return s.prices.retrieve(id);
    case 'customer':return s.customers.retrieve(id);
    case 'subscription':return s.subscriptions.retrieve(id);
    default:throw new TypeError('Unsupported synthetic setup step');
  }
}
export async function executeSubscriptionSetup({p,ctx,stripe,rootKey}){
  const db=ctx.db,account=p.account,id=p.runId;
  const run=await db.ensureDevRun({id,account,
    connection:ctx.connectionId??null,requestKey:p.requestKey,
    scenario:p.scenario,size:p.months,planDigest:p.planDigest});
  assert(['running','completed'].includes(run.status)&&
    Date.now()-new Date(run.created_at).getTime()<=43200000,
    'Expired, uncertain or stale TEST simulation cannot be resumed');
  const rows=await db.getDevRunObjects({account,id});
  const byName=new Map(rows.map(x=>[x.step_name,x]));
  for(const step of p.steps){
    const previous=byName.get(step.stepName);
    if(previous){
      assert(previous.object_type===step.objectType&&
        previous.cleaned===false,'Recorded test object identity was changed or cleaned');
      const observed=await retrieve(stripe,step.objectType,previous.object_id);
      verifyStep(step,observed,p,[...byName].map(([step_name,v])=>({
        step_name,object_id:v.object_id
      })));
      continue;
    }
    assert(run.status==='running',
      'Completed TEST simulation cannot add provider objects');
    const refs=Object.fromEntries([...byName].map(([k,x])=>[k,x.object_id]));
    const metadata={rtc_run:id};
    const options={idempotencyKey:rootKey+'_'+step.stepName};
    let created;
    switch(step.objectType){
      case 'test_clock':
        created=await stripe.testHelpers.testClocks.create({
          name:fakeName(id),frozen_time:p.frozenTime},options);break;
      case 'product':
        created=await stripe.products.create({
          name:'RTC DEV Subscription Simulation',metadata},options);break;
      case 'price':
        assert(matches(refs.product_1,'prod'),'Verified synthetic product required');
        created=await stripe.prices.create({
          product:refs.product_1,currency:'usd',unit_amount:p.amountCents,
          recurring:{interval:'month'},metadata},options);break;
      case 'customer':
        assert(matches(refs.clock_1,'clock'),'Verified TEST clock required');
        created=await stripe.customers.create({
          name:'RTC DEV Simulated Customer',test_clock:refs.clock_1,
          payment_method:p.card,invoice_settings:{default_payment_method:p.card},
          metadata},options);break;
      case 'subscription':
        assert(matches(refs.price_1,'price')&&matches(refs.customer_1,'cus'),
          'Verified tracked customer and monthly price required');
        created=await stripe.subscriptions.create({
          customer:refs.customer_1,items:[{price:refs.price_1}],
          collection_method:'charge_automatically',
          billing_mode:{type:'flexible'},payment_behavior:'error_if_incomplete',
          proration_behavior:'none',trial_period_days:1,metadata
        },options);break;
    }
    assert(matches(created?.id,{test_clock:'clock',product:'prod',
      price:'price',customer:'cus',subscription:'sub'}[step.objectType])&&
      created.livemode===false,'Stripe did not acknowledge the TEST creation');
    // Read-back must succeed *before* adding the exact created ID to cleanup.
    // An interrupted step resumes with the same Stripe idempotency key.
    const observed=await retrieve(stripe,step.objectType,created.id);
    const post=[...byName].map(([step_name,v])=>({step_name,object_id:v.object_id}));
    verifyStep(step,observed,p,post);
    assert(await db.recordDevRunObject({account,id,stepName:step.stepName,
      objectType:step.objectType,objectId:created.id}),
      'Could not persist verified synthetic TEST object for cleanup');
    byName.set(step.stepName,{object_id:created.id,object_type:step.objectType,
      cleaned:false});
  }
  assert(await db.completeDevRun({account,id,expectedSteps:p.steps.length}),
    'Synthetic TEST run is not complete');
  return {runId:id,status:'completed',objectCount:p.steps.length};
}
