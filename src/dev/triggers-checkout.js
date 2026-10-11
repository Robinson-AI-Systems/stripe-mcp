// Provider-real Checkout requires an actual Stripe-hosted customer action.
// There is no server-side Checkout Session completion endpoint.
const fail=x=>{throw new TypeError(x);};
const ref=x=>typeof x==='string'?x:x?.id;
const id=(x,p)=>typeof x==='string'&&
  new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(x);
export const checkoutEventTypes=Object.freeze(['checkout.session.completed']);
export const isCheckoutEvent=t=>checkoutEventTypes.includes(t);

export function verifyCheckoutSession(plan,session,rows,completed=false){
  if(!isCheckoutEvent(plan.type))return;
  if(!id(session?.id,'cs_test')||session.object!=='checkout.session'||
    session.livemode!==false||session.metadata?.rtc_run!==plan.runId||
    session.client_reference_id!==plan.runId||
    ref(session.customer)!==rows.get('customer_1')?.object_id||
    session.mode!=='payment'||session.currency!=='usd'||
    session.amount_total!==3600||!['open','complete'].includes(session.status)||
    !['unpaid','paid'].includes(session.payment_status))
    fail('Stripe TEST hosted Checkout ownership, price or state differs');
  if(completed&&(session.status!=='complete'||session.payment_status!=='paid'||
    !id(ref(session.payment_intent),'pi')))
    fail('Stripe-hosted Checkout has not actually completed a paid TEST card');
}
export function verifyCheckoutPayment(plan,p,rows){
  if(p?.object!=='payment_intent'||!id(p.id,'pi')||p.livemode!==false||
    p.metadata?.rtc_run!==plan.runId||
    ref(p.customer)!==rows.get('customer_1')?.object_id||
    p.currency!=='usd'||p.amount!==3600||p.amount_received!==3600||
    p.status!=='succeeded')
    fail('Stripe-hosted Checkout generated no independently proven TEST card payment');
}
export function matchesCheckoutEvent(plan,object,target){
  if(!isCheckoutEvent(plan.type))return true;
  try{
    verifyCheckoutSession(plan,object,new Map([
      ['customer_1',{object_id:target.customer}]
    ]),true);
    return object.id===target.id&&
      ref(object.payment_intent)===target.paymentIntent;
  }catch{return false;}
}
export function verifiedHostedCheckoutUrl(session){
  if(session?.status!=='open'||session.payment_status!=='unpaid')return null;
  const url=session.url;
  if(typeof url!=='string'||!/^https:\/\/checkout\.stripe\.com\//.test(url))
    fail('No authentic Stripe-hosted TEST Checkout URL is available');
  return url;
}
