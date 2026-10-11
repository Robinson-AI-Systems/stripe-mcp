// V-1a developer seed scenarios. All generated records are TEST-only and tagged rtc_run.
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
export const safeSeedScenario='catalog-starter';
export function planSeed(a,account){
  if(typeof account!=='string'||!/^acct_[A-Za-z0-9]+$/.test(account)||
    a?.scenario!==safeSeedScenario||
    !Number.isInteger(a.size)||a.size<1||a.size>5||
    typeof a.requestKey!=='string'||a.requestKey.length<1||
    a.requestKey.length>128)
    throw new TypeError('Choose catalog-starter, size 1–5 and a stable requestKey. Other scenarios follow in V-1b');
  const runId='run_'+sha(JSON.stringify([account,a.requestKey])).slice(0,24);
  const steps=[];
  for(let i=1;i<=a.size;i++){
    steps.push({name:'product_'+i,type:'product',label:'RTC Test Product '+i,
      amountCents:3500+i*100});
    steps.push({name:'price_'+i,type:'price',label:'Monthly TEST price '+i,
      amountCents:3500+i*100});
    steps.push({name:'customer_'+i,type:'customer',label:'RTC Test Customer '+i});
  }
  return {runId,scenario:safeSeedScenario,size:a.size,steps,
    planDigest:sha(JSON.stringify(steps)),expectedSteps:steps.length};
}
export function seedDescription(plan){
  return 'TEST MODE. Prepare tracked '+plan.scenario+' scenario run '+plan.runId+
    ' with '+plan.size+' fake products, '+plan.size+' recurring USD prices and '+
    plan.size+' synthetic customers ('+plan.expectedSteps+' records). '+
    'Each provider-created ID will be read back and saved for precise cleanup.'+
    ' No real payments, refunds, disputes or LIVE operations. '+
    'These additional scenarios follow in V-1b.';
}
export async function executeSeed({plan,run,stripe,db,account,rootKey}){
  if(run.status==='completed')return run;
  if(run.status!=='running'||Date.now()-new Date(run.created_at).getTime()>43200000)
    throw new TypeError('Stale/uncertain seed run cannot be retried safely; manual review required');
  const existing=await db.getDevRunObjects({account,id:plan.runId});
  const byStep=new Map(existing.map(x=>[x.step_name,x]));
  const byType={product:'prod',price:'price',customer:'cus'};
  for(const step of plan.steps){
    const prior=byStep.get(step.name);
    if(prior){
      if(prior.object_type!==step.type||!new RegExp('^'+byType[step.type]+'_').test(prior.object_id))
        throw new TypeError('Recorded TEST object has inconsistent type');
      continue;
    }
    const idx=Number(step.name.split('_').at(-1));
    const opts={idempotencyKey:rootKey+'_'+step.name};
    const metadata={rtc_run:plan.runId};
    let created,retrieved;
    if(step.type==='product'){
      created=await stripe.products.create({name:step.label,metadata},opts);
      if(created?.object!=='product'||!/^prod_[A-Za-z0-9]{2,100}$/.test(created.id??''))
        throw new TypeError('Stripe product creation not verified');
      retrieved=await stripe.products.retrieve(created.id);
    }else if(step.type==='price'){
      const product=byStep.get('product_'+idx)?.object_id;
      if(!product)throw new TypeError('A recorded TEST product must precede its price');
      created=await stripe.prices.create({product,currency:'usd',
        unit_amount:step.amountCents,recurring:{interval:'month'},metadata},opts);
      if(created?.object!=='price'||!/^price_[A-Za-z0-9]{2,100}$/.test(created.id??''))
        throw new TypeError('Stripe price creation not verified');
      retrieved=await stripe.prices.retrieve(created.id);
      if((typeof retrieved.product==='string'?retrieved.product:retrieved.product?.id)!==product||
        retrieved.unit_amount!==step.amountCents)
        throw new TypeError('Created price differs from requested verified TEST product/cents');
    }else{
      created=await stripe.customers.create({name:step.label,
        email:'rtc-test+'+plan.runId+'-'+idx+'@example.test',metadata},opts);
      if(created?.object!=='customer'||!/^cus_[A-Za-z0-9]{2,100}$/.test(created.id??''))
        throw new TypeError('Stripe customer creation not verified');
      retrieved=await stripe.customers.retrieve(created.id);
    }
    if(retrieved?.id!==created.id||retrieved.metadata?.rtc_run!==plan.runId)
      throw new TypeError('Independent Stripe read-back did not verify rtc_run metadata');
    const saved=await db.recordDevRunObject({account,id:plan.runId,
      stepName:step.name,objectType:step.type,objectId:created.id});
    if(!saved)throw new Error('TEST run object not durably recorded; outcome uncertain');
    byStep.set(step.name,{step_name:step.name,object_type:step.type,
      object_id:created.id});
  }
  if(!(await db.completeDevRun({account,id:plan.runId,
    expectedSteps:plan.expectedSteps})))
    throw new Error('Not all TEST run objects have been durably recorded');
  return db.getDevRun({account,requestKey:run.request_key});
}
