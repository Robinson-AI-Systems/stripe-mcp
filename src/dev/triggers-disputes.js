// Provider-real Stripe TEST disputes: an async dispute is not implied by a
// successful card payment. Every dispute must link to this run's exact charge.
const fail=s=>{throw new TypeError(s);};
const valid=(x,p)=>typeof x==='string'&&
  new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(x);
const ref=x=>typeof x==='string'?x:x?.id;
export const disputeEventTypes=Object.freeze(['charge.dispute.created']);
export const isDisputeEvent=type=>disputeEventTypes.includes(type);
export const verifiedDisputeCharge=(plan,charge,rows)=>{
  const payment=rows.get('payment_intent_1')?.object_id;
  const customer=rows.get('customer_1')?.object_id;
  if(!valid(charge?.id,'ch')||charge.object!=='charge'||
    charge.livemode===true||ref(charge.payment_intent)!==payment||
    ref(charge.customer)!==customer||charge.amount!==3600||
    charge.currency!=='usd'||charge.paid!==true||
    charge.status!=='succeeded')fail('TEST dispute charge ownership/paid state differs');
};
export const verifiedDisputeObject=(plan,d,rows)=>{
  const charge=rows.get('charge_1')?.object_id;
  const payment=rows.get('payment_intent_1')?.object_id;
  if(!valid(d?.id,'du')||d.object!=='dispute'||d.livemode===true||
    ref(d.charge)!==charge||
    (d.payment_intent!=null&&ref(d.payment_intent)!==payment)||
    d.amount!==3600||d.currency!=='usd')
    fail('TEST dispute provider object does not match recorded charge and payment');
};
export async function findActualDispute(s,plan,rows){
  const chargeId=rows.get('charge_1')?.object_id;
  if(!valid(chargeId,'ch'))fail('Exact run-owned charge required for dispute search');
  const charge=await s.charges.retrieve(chargeId);
  verifiedDisputeCharge(plan,charge,rows);
  if(charge.disputed!==true)return null;
  // Exact provider filter prevents searching unrelated accounts or customer data.
  let cursor=null;
  for(let page=0;page<3;page++){
    const result=await s.disputes.list({charge:chargeId,limit:100,
      ...(cursor?{starting_after:cursor}:{})});
    if(!Array.isArray(result?.data)||typeof result.has_more!=='boolean'||
      result.data.length>100)fail('Unverifiable Stripe dispute listing');
    for(const candidate of result.data){
      if(!valid(candidate?.id,'du'))continue;
      const d=await s.disputes.retrieve(candidate.id);
      verifiedDisputeObject(plan,d,rows);
      return d;
    }
    if(!result.has_more||!result.data.length)return null;
    cursor=result.data.at(-1)?.id;
    if(!valid(cursor,'du'))fail('Invalid dispute pagination cursor');
  }
  return null; // never invent asynchronous dispute arrival
}
export function matchesDisputeEvent(e,plan,account,target){
  if(!isDisputeEvent(plan.type))return false;
  const d=e?.data?.object;
  return e?.object==='event'&&valid(e.id,'evt')&&e.type===plan.type&&
    e.livemode===false&&(!e.account||e.account===account)&&
    d?.object==='dispute'&&d.id===target.id&&
    ref(d.charge)===target.charge&&
    (d.payment_intent==null||ref(d.payment_intent)===target.paymentIntent)&&
    d.amount===3600&&d.currency==='usd'&&d.livemode!==true;
}
