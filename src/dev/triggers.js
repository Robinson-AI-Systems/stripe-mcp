// Curated real Stripe TEST events from actual audited provider actions.
// No fake CLI fixture or simulated event success response.
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const bad=x=>{throw new TypeError(x);};
const id=(v,p)=>typeof v==='string'&&new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(v);
const ref=x=>typeof x==='string'?x:x?.id;
export const triggerTypes=Object.freeze([
  'customer.created','product.created','price.created',
  'payment_intent.succeeded'
]);
const kind={customer:'customer',product:'product',price:'price',
  payment_intent:'payment_intent'};
const prefix={customer:'cus',product:'prod',price:'price',payment_intent:'pi'};
const read=async(s,type,providerId)=>{
  switch(type){
    case 'customer':return s.customers.retrieve(providerId);
    case 'product':return s.products.retrieve(providerId);
    case 'price':return s.prices.retrieve(providerId);
    case 'payment_intent':return s.paymentIntents.retrieve(providerId);
    default:bad('Unsupported TEST provider fixture');
  }
};
export function planTrigger(a,account){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['type','requestKey','dryRun','confirm'].includes(k))||
    !triggerTypes.includes(a.type)||!id(account,'acct')||
    typeof a.requestKey!=='string'||a.requestKey.length<1||
    a.requestKey.length>128)bad('Unsupported TEST event or retry key; use dev_list_triggers');
  const runId='run_'+hash(JSON.stringify([account,a.requestKey])).slice(0,24);
  const types=a.type==='price.created'?['product','price']:
    a.type==='payment_intent.succeeded'?['customer','payment_intent']:
    [a.type.split('.')[0]];
  const steps=types.map((type,i)=>({name:type+'_'+(i+1),type}))
    .concat([{name:'event_1',type:'event'}]);
  return {runId,scenario:'event-'+a.type.replaceAll('_','-').replace('.','-'),
    type:a.type,steps,size:1,expectedSteps:steps.length,
    planDigest:hash(JSON.stringify([a.type,steps])),amountCents:
      a.type==='payment_intent.succeeded'?3600:0};
}
function verifyFixture(plan,step,x,objects){
  if(x?.object!==kind[step.type]||!id(x.id,prefix[step.type])||
    x.livemode===true||x.metadata?.rtc_run!==plan.runId)
    bad('Independent Stripe TEST event fixture provenance differs');
  if(step.type==='price'&&(
    ref(x.product)!==objects.get('product_1')?.object_id||
    x.currency!=='usd'||x.amount!==undefined&&x.amount!==3600||
    x.unit_amount!==3600||x.type!=='one_time'))
    bad('TEST event price differs from exact immutable plan');
  if(step.type==='payment_intent'&&(
    x.amount!==3600||x.amount_received!==3600||x.currency!=='usd'||
    x.status!=='succeeded'||ref(x.customer)!==
      objects.get('customer_1')?.object_id))
    bad('Stripe did not independently confirm full TEST card payment');
  return x;
}
function matchingEvent(e,plan,account,target){
  const object=e?.data?.object;
  return e?.object==='event'&&id(e.id,'evt')&&e.type===plan.type&&
    e.livemode===false&&(!e.account||e.account===account)&&
    object?.object===target.type&&object.id===target.id&&
    object.metadata?.rtc_run===plan.runId&&
    (target.type!=='payment_intent'||(
      object.status==='succeeded'&&object.amount===3600&&
      object.amount_received===3600&&object.currency==='usd'&&
      ref(object.customer)===target.customer));
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
            product,unit_amount:3600,currency:'usd',metadata},opts);break;
        }
        case 'payment_intent':{
          const customer=byStep.get('customer_1')?.object_id;
          if(!id(customer,'cus'))bad('Verified TEST event customer must precede payment');
          made=await s.paymentIntents.create({
            customer,amount:3600,currency:'usd',payment_method:'pm_card_visa',
            confirm:true,metadata,description:'Tracked synthetic TEST event charge'
          },opts);break;
        }
        default:bad('Unsupported TEST event action');
      }
      if(made?.object!==kind[step.type]||!id(made.id,prefix[step.type])||
        made.livemode===true)
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
  }
  const target=plan.steps.at(-2);
  const targetId=byStep.get(target.name)?.object_id;
  const customer=byStep.get('customer_1')?.object_id;
  if(!id(targetId,prefix[target.type]))bad('No verified TEST event source exists');
  const signature={id:targetId,type:target.type,customer};
  const old=byStep.get('event_1');
  if(old&&(old.object_type!=='event'||old.cleaned!==false||
    !id(old.object_id,'evt')))
    bad('TEST event ledger has inconsistent identity');
  const eventId=await findGeneratedEvent(s,plan,account,signature);
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
