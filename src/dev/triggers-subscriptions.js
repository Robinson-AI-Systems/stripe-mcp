// V-3c1: genuinely generated TEST subscription lifecycle events.
// A trial avoids charging any card; the automatically linked zero-dollar
// invoice must also be independently verified and tracked for safe cleanup.
export const subscriptionEventTypes=Object.freeze([
  'customer.subscription.created','customer.subscription.deleted'
]);
const fail=x=>{throw new TypeError(x);};
const id=(x,p)=>typeof x==='string'&&
  new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(x);
const ref=x=>typeof x==='string'?x:x?.id;
export const isSubscriptionEvent=type=>subscriptionEventTypes.includes(type);
export function verifySubscriptionObject(plan,sub,byStep){
  if(!id(sub?.id,'sub')||sub.object!=='subscription'||
    sub.livemode===true||sub.metadata?.rtc_run!==plan.runId||
    ref(sub.customer)!==byStep.get('customer_1')?.object_id||
    !Array.isArray(sub.items?.data)||
    !sub.items.data.some(item=>
      ref(item.price)===byStep.get('price_1')?.object_id)||
    !['trialing',...(plan.type==='customer.subscription.deleted'?
      ['canceled']:[])].includes(sub.status))
    fail('Independent TEST subscription provenance/trial state differs');
}
export function matchingSubscriptionEvent(plan,obj,target){
  if(!isSubscriptionEvent(plan.type))return true;
  const status=plan.type==='customer.subscription.deleted'?'canceled':'trialing';
  return obj?.object==='subscription'&&obj.status===status&&
    ref(obj.customer)===target.customer&&
    Array.isArray(obj.items?.data)&&obj.items.data.some(x=>
      ref(x.price)===target.price)&&
    obj.metadata?.rtc_run===plan.runId;
}
export async function verifyTrialInvoice(stripe,sub,plan,customerId,key){
  const invoiceId=ref(sub?.latest_invoice);
  if(!id(invoiceId,'in'))fail('Trial TEST subscription invoice not available');
  let invoice=await stripe.invoices.retrieve(invoiceId);
  if(invoice?.object!=='invoice'||invoice.id!==invoiceId||
    invoice.livemode===true||invoice.status!=='paid'||
    invoice.currency!=='usd'||invoice.amount_paid!==0||
    ref(invoice.customer)!==customerId)
    fail('Provider TEST trial invoice has an unexpected payment state');
  if(invoice.metadata?.rtc_run!==plan.runId){
    if(invoice.metadata?.rtc_run!==undefined)
      fail('Trial invoice is tagged for another TEST run');
    await stripe.invoices.update(invoiceId,{
      metadata:{rtc_run:plan.runId}
    },{idempotencyKey:key+'_invoice_tag'});
    invoice=await stripe.invoices.retrieve(invoiceId);
    if(invoice?.id!==invoiceId||invoice.status!=='paid'||
      invoice.amount_paid!==0||ref(invoice.customer)!==customerId||
      invoice.metadata?.rtc_run!==plan.runId||invoice.livemode===true)
      fail('Trial invoice metadata and zero payment not verified after update');
  }
  return invoice;
}
export async function cancelTrialSubscription(stripe,plan,byStep,rootKey){
  if(plan.type!=='customer.subscription.deleted')return;
  const subId=byStep.get('subscription_1')?.object_id;
  if(!id(subId,'sub'))fail('Recorded subscription needed before TEST cancel');
  const before=await stripe.subscriptions.retrieve(subId);
  verifySubscriptionObject(plan,before,byStep);
  if(before.status!=='canceled'){
    if(before.status!=='trialing')fail('Cannot cancel a nontrial TEST subscription');
    const ack=await stripe.subscriptions.cancel(subId,{
      invoice_now:false,prorate:false
    },{idempotencyKey:rootKey+'_subscription_cancel'});
    if(ack?.id!==subId||ack.object!=='subscription'||
      ack.status!=='canceled'||ack.livemode===true)
      fail('TEST subscription cancellation was not acknowledged');
  }
  const after=await stripe.subscriptions.retrieve(subId);
  verifySubscriptionObject(plan,after,byStep);
  if(after.status!=='canceled')
    fail('Stripe did not independently confirm canceled TEST subscription');
}
