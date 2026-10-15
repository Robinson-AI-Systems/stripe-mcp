// Genuine TEST charge Events. The Charge may not inherit PaymentIntent metadata;
// immutable PI/customer/charge ledger linkage supplies independent provenance.
export const nativeChargeEventTypes=Object.freeze([
  'charge.succeeded','charge.updated'
]);
export const isNativeChargeEvent=x=>nativeChargeEventTypes.includes(x);
const ref=x=>typeof x==='string'?x:x?.id;
const valid=(x,p)=>typeof x==='string'&&
  new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(x);
const fail=x=>{throw new TypeError(x);};
const changedDescription='RTC Synthetic TEST Updated Charge';
export function verifyNativeCharge(plan,charge,rows,{final=false}={}){
  if(!isNativeChargeEvent(plan.type))return;
  if(!valid(charge?.id,'ch')||charge.object!=='charge'||
    charge.livemode!==false||
    ref(charge.payment_intent)!==rows.get('payment_intent_1')?.object_id||
    ref(charge.customer)!==rows.get('customer_1')?.object_id||
    charge.amount!==3600||charge.currency!=='usd'||
    charge.paid!==true||charge.status!=='succeeded'||
    charge.refunded===true)
    fail('Native TEST charge does not match original recorded paid source');
  if(final&&plan.type==='charge.updated'&&
    charge.description!==changedDescription)
    fail('Native TEST Charge update not independently observed');
}
export function matchesNativeChargeEvent(e,plan,account,target){
  if(!isNativeChargeEvent(plan.type))return false;
  const charge=e?.data?.object;
  if(e?.object!=='event'||!valid(e.id,'evt')||
    e.livemode!==false||e.type!==plan.type||
    e.account&&e.account!==account)return false;
  try{
    verifyNativeCharge(plan,charge,new Map([
      ['customer_1',{object_id:target.customer}],
      ['payment_intent_1',{object_id:target.paymentIntent}]
    ]),{final:true});
    return charge.id===target.id;
  }catch{return false;}
}
export async function ensureNativeChargeEvent(s,plan,rows,key){
  if(!isNativeChargeEvent(plan.type))return;
  const id=rows.get('charge_1')?.object_id;
  if(!valid(id,'ch'))fail('Exact recorded TEST Charge required');
  let charge=await s.charges.retrieve(id);
  verifyNativeCharge(plan,charge,rows);
  if(plan.type==='charge.succeeded'||charge.description===changedDescription)
    return;
  const changed=await s.charges.update(id,{
    description:changedDescription
  },{idempotencyKey:key+'_charge_update'});
  if(changed?.object!=='charge'||changed.id!==id||
    changed.livemode!==false)
    fail('Exact Stripe TEST Charge update was not acknowledged');
  charge=await s.charges.retrieve(id);
  verifyNativeCharge(plan,charge,rows,{final:true});
}
