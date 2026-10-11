// Actual TEST mutation actions behind additional V-3 trigger event names.
const check=(v,p)=>typeof v==='string'&&
  new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(v);
const fail=x=>{throw new TypeError(x);};
const ref=x=>typeof x==='string'?x:x?.id;
export const mutationTypes=Object.freeze([
  'customer.updated','product.updated','price.updated',
  'payment_intent.canceled'
]);
const mutations=Object.freeze({
  'customer.updated':{type:'customer',field:'description',
    value:'RTC Event Updated Customer'},
  'product.updated':{type:'product',field:'name',
    value:'RTC Event Updated Product'},
  'price.updated':{type:'price',field:'nickname',
    value:'RTC Event Updated Price'},
  'payment_intent.canceled':{type:'payment_intent',field:'status',
    value:'canceled'}
});
export function requiresTriggerMutation(plan,step){
  return mutations[plan.type]?.type===step.type;
}
export function assertMutatedEvent(plan,object){
  const mutation=mutations[plan.type];
  if(!mutation)return true;
  return object?.object===mutation.type&&
    object[mutation.field]===mutation.value&&
    (mutation.type!=='payment_intent'||(
      object.amount_received===0&&object.amount===3600&&
      object.currency==='usd'));
}
export async function mutateEventSource(s,plan,step,source,rootKey){
  const m=mutations[plan.type];
  if(!m||!requiresTriggerMutation(plan,step))
    fail('This TEST event does not require a source mutation');
  const kind=step.type,opts={idempotencyKey:rootKey+'_'+step.name+'_mutation'};
  if(source?.object!==kind||source.livemode===true||
    source.metadata?.rtc_run!==plan.runId)
    fail('Recorded TEST mutation source provenance differs before action');
  let changed;
  switch(plan.type){
    case 'customer.updated':
      if(!check(source.id,'cus'))fail('Expected recorded TEST customer');
      changed=await s.customers.update(source.id,{description:m.value},opts);
      break;
    case 'product.updated':
      if(!check(source.id,'prod'))fail('Expected recorded TEST product');
      changed=await s.products.update(source.id,{name:m.value},opts);
      break;
    case 'price.updated':
      if(!check(source.id,'price'))fail('Expected recorded TEST price');
      changed=await s.prices.update(source.id,{nickname:m.value},opts);
      break;
    case 'payment_intent.canceled':
      if(!check(source.id,'pi')||!['requires_confirmation','canceled']
        .includes(source.status)||source.amount_received!==0||
        ref(source.customer)===null)
        fail('Only an unconfirmed synthetic TEST PaymentIntent can be canceled');
      // Never cancel a processing or succeeded payment.
      changed=source.status==='canceled'?source:
        await s.paymentIntents.cancel(source.id,{},opts);
      break;
    default:fail('Unsupported Stripe TEST mutation action');
  }
  if(changed?.object!==kind||changed.id!==source.id||
    changed.livemode===true)
    fail('Stripe did not acknowledge the exact synthetic TEST mutation');
  return changed;
}
