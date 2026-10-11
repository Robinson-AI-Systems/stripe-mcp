// V-3c3a: genuine TEST card decline and observed Stripe payment failure Event.
// One run-owned, unconfirmed intent is durably recorded before the failed attempt.
const fail=message=>{throw new TypeError(message);};
const ref=value=>typeof value==='string'?value:value?.id;
export const failedPaymentEventTypes=Object.freeze(['payment_intent.payment_failed']);
export const isFailedPaymentEvent=type=>failedPaymentEventTypes.includes(type);

export function verifyFailedPayment(plan,intent,customer,attempted=false){
  if(!isFailedPaymentEvent(plan.type))return;
  if(intent?.object!=='payment_intent'||intent.livemode===true||
    intent.metadata?.rtc_run!==plan.runId||
    ref(intent.customer)!==customer||
    intent.amount!==3600||intent.currency!=='usd'||intent.amount_received!==0||
    !['requires_confirmation','requires_payment_method'].includes(intent.status))
    fail('Stripe TEST decline source identity, status or amount differs');
  if((attempted||intent.status==='requires_payment_method')&&
    (intent.status!=='requires_payment_method'||
      intent.last_payment_error?.code!=='card_declined'))
    fail('Stripe has not independently verified a declined TEST card attempt');
}

export async function ensureFailedPayment(s,plan,intent,customer,rootKey){
  if(!isFailedPaymentEvent(plan.type))return;
  verifyFailedPayment(plan,intent,customer);
  if(intent.status==='requires_confirmation'){
    try{
      // Stripe throws StripeCardError for a TEST decline; this error itself
      // never proves the event. Only independently retrieved state does.
      const response=await s.paymentIntents.confirm(intent.id,{
        payment_method:'pm_card_chargeCustomerFail'
      },{idempotencyKey:rootKey+'_declined_confirmation'});
      if(response?.status!=='requires_payment_method')
        fail('Stripe TEST card did not decline as requested');
    }catch(error){
      if(error?.code!=='card_declined')throw error;
    }
  }
  const after=await s.paymentIntents.retrieve(intent.id);
  verifyFailedPayment(plan,after,customer,true);
}

export function matchesFailedPaymentEvent(plan,object,target){
  if(!isFailedPaymentEvent(plan.type))return true;
  try{
    verifyFailedPayment(plan,object,target.customer,true);
    return object.id===target.id;
  }catch{return false;}
}
