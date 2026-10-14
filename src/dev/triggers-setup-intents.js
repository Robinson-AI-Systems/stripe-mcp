// Run-owned native Stripe SetupIntent events; no card charge or customer change.
export const setupIntentEventTypes=Object.freeze([
  'setup_intent.created','setup_intent.canceled','setup_intent.succeeded'
]);
export const isSetupIntentEvent=x=>setupIntentEventTypes.includes(x);
const fail=x=>{throw new TypeError(x);};
export function verifySetupIntent(plan,x,{final=false}={}){
  if(!isSetupIntentEvent(plan.type))return;
  if(typeof x?.id!=='string'||!/^seti_[A-Za-z0-9]{2,100}$/.test(x.id)||
    x.object!=='setup_intent'||x.livemode!==false||
    x.metadata?.rtc_run!==plan.runId||x.customer!==null||
    x.usage!=='off_session'||!Array.isArray(x.payment_method_types)||
    !x.payment_method_types.includes('card')||
    !['requires_payment_method','canceled','succeeded'].includes(x.status))
    fail('Selected TEST SetupIntent provenance, ownership or state differs');
  const target=plan.type==='setup_intent.created'?'requires_payment_method':
    plan.type==='setup_intent.canceled'?'canceled':'succeeded';
  if(final&&x.status!==target)fail('Original TEST SetupIntent event state differs');
}
export function matchesSetupIntentEvent(plan,source,target){
  if(!isSetupIntentEvent(plan.type))return true;
  try{verifySetupIntent(plan,source,{final:true});return source.id===target.id;}
  catch{return false;}
}
export async function ensureSetupIntentEvent(s,plan,source,key){
  if(!isSetupIntentEvent(plan.type))return;
  verifySetupIntent(plan,source);
  if(plan.type==='setup_intent.created')return;
  if(source.status==='canceled'||source.status==='succeeded'){
    verifySetupIntent(plan,source,{final:true});
    return;
  }
  if(source.status!=='requires_payment_method')
    fail('Cannot replay unexpected TEST SetupIntent state');
  const options={idempotencyKey:key+'_setup_action'};
  const ack=plan.type==='setup_intent.canceled'?
    await s.setupIntents.cancel(source.id,{cancellation_reason:'abandoned'},options):
    await s.setupIntents.confirm(source.id,{payment_method:'pm_card_visa'},options);
  if(ack?.id!==source.id||ack.object!=='setup_intent'||ack.livemode!==false)
    fail('Exact TEST SetupIntent change was not acknowledged');
  verifySetupIntent(plan,await s.setupIntents.retrieve(source.id),{final:true});
}
