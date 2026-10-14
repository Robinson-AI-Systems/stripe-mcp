// Curated genuine PaymentMethod lifecycle events on isolated TEST cards.
// The unowned test card is tagged and ledger-recorded BEFORE attachment.
// No live cards, money movement, card details or implicit subscription defaults.
export const paymentMethodEventTypes=Object.freeze([
  'payment_method.attached','payment_method.updated','payment_method.detached'
]);
export const isPaymentMethodEvent=type=>paymentMethodEventTypes.includes(type);
const ref=x=>typeof x==='string'?x:x?.id;
const id=(x,p)=>typeof x==='string'&&
  new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(x);
const fail=x=>{throw new TypeError(x);};
const changeName='RTC TEST Event Updated Card';
export function verifyMethodFixture(plan,method,rows,{final=false}={}){
  if(!isPaymentMethodEvent(plan.type))return;
  const customer=rows.get('customer_1')?.object_id;
  const recorded=rows.get('payment_method_1')?.object_id;
  const owner=ref(method?.customer)??null;
  if(!id(customer,'cus')||!id(method?.id,'pm')||
    recorded&&recorded!==method.id||
    method?.object!=='payment_method'||method?.livemode!==false||
    method.type!=='card'||method.metadata?.rtc_run!==plan.runId||
    owner!==null&&owner!==customer)
    fail('Tracked TEST card source has foreign owner, type, or provenance');
  if(final){
    if((plan.type==='payment_method.detached'&&owner!==null)||
      (plan.type!=='payment_method.detached'&&owner!==customer)||
      (plan.type==='payment_method.updated'&&
        method.billing_details?.name!==changeName)||
      (plan.type==='payment_method.detached'&&
        method.metadata?.rtc_pm_detach_ready!=='1'))
      fail('Native TEST PaymentMethod did not reach exact expected state');
  }
}
export function matchesPaymentMethodEvent(plan,source,target){
  if(!isPaymentMethodEvent(plan.type))return true;
  const owner=ref(source?.customer)??null;
  return source?.object==='payment_method'&&source.id===target.id&&
    source.livemode===false&&source.type==='card'&&
    source.metadata?.rtc_run===plan.runId&&
    (plan.type==='payment_method.detached'?
      owner===null&&source.metadata?.rtc_pm_detach_ready==='1':
      owner===target.customer)&&
    (plan.type!=='payment_method.updated'||
      source.billing_details?.name===changeName);
}
export async function ensurePaymentMethodEvent(s,plan,rows,key){
  if(!isPaymentMethodEvent(plan.type))return;
  const customer=rows.get('customer_1')?.object_id;
  const pm=rows.get('payment_method_1')?.object_id;
  if(!id(customer,'cus')||!id(pm,'pm'))
    fail('Exact recorded TEST card and owner required');
  let current=await s.paymentMethods.retrieve(pm);
  verifyMethodFixture(plan,current,rows);
  // Detachment is terminal: the attached+tagged marker makes retries
  // distinguish a completed detach from a newly created unattached card.
  if(plan.type==='payment_method.detached'&&
    (ref(current.customer)??null)===null&&
    current.metadata?.rtc_pm_detach_ready==='1'){
    verifyMethodFixture(plan,current,rows,{final:true});
    return;
  }
  if((ref(current.customer)??null)===null){
    const joined=await s.paymentMethods.attach(pm,{customer},{
      idempotencyKey:key+'_method_attach'});
    verifyMethodFixture(plan,joined,rows);
    if(ref(joined.customer)!==customer)
      fail('Stripe did not acknowledge exact TEST card attachment');
    current=await s.paymentMethods.retrieve(pm);
    verifyMethodFixture(plan,current,rows);
    if(ref(current.customer)!==customer)
      fail('Stripe did not independently confirm TEST card attachment');
  }
  if(plan.type==='payment_method.updated'&&
    current.billing_details?.name!==changeName){
    const updated=await s.paymentMethods.update(pm,{
      billing_details:{name:changeName}
    },{idempotencyKey:key+'_method_update'});
    verifyMethodFixture(plan,updated,rows);
  }
  if(plan.type==='payment_method.detached'&&
    current.metadata?.rtc_pm_detach_ready!=='1'){
    const receipt=await s.paymentMethods.update(pm,{
      metadata:{rtc_run:plan.runId,rtc_pm_detach_ready:'1'}
    },{idempotencyKey:key+'_method_detach_ready'});
    verifyMethodFixture(plan,receipt,rows);
    current=await s.paymentMethods.retrieve(pm);
    verifyMethodFixture(plan,current,rows);
    if(current.metadata.rtc_pm_detach_ready!=='1')
      fail('Stripe did not confirm TEST card detach-ready provenance');
  }
  if(plan.type==='payment_method.detached'&&
    (ref(current.customer)??null)!==null){
    const removed=await s.paymentMethods.detach(pm,{},{
      idempotencyKey:key+'_method_detach'});
    verifyMethodFixture(plan,removed,rows);
  }
  const after=await s.paymentMethods.retrieve(pm);
  verifyMethodFixture(plan,after,rows,{final:true});
}
