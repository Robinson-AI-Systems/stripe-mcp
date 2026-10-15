import {describe,it,expect} from 'vitest';
import {planTrigger} from '../../src/dev/triggers.js';
import {verifyNativeCharge,matchesNativeChargeEvent,ensureNativeChargeEvent}
  from '../../src/dev/triggers-charge-events.js';
const account='acct_CHARGE123',customer='cus_CHARGE123',
  payment='pi_CHARGE123',chargeId='ch_CHARGE123';
const make=type=>planTrigger({type,requestKey:type},account);
const rows=new Map([
  ['customer_1',{object_id:customer}],
  ['payment_intent_1',{object_id:payment}],
  ['charge_1',{object_id:chargeId}]
]);
const source=extra=>({
  id:chargeId,object:'charge',livemode:false,customer,
  payment_intent:payment,amount:3600,currency:'usd',
  paid:true,refunded:false,status:'succeeded',...extra
});
function fixture(){
  let now=source();const calls=[];
  const sdk={charges:{
    retrieve:async id=>{
      expect(id).toBe(chargeId);calls.push('read');return {...now};
    },
    update:async(id,p,o)=>{
      expect(id).toBe(chargeId);
      expect(p).toEqual({description:'RTC Synthetic TEST Updated Charge'});
      expect(o.idempotencyKey).toMatch(/^rmcp_/);
      calls.push('update');now={...now,...p};return {...now};
    }
  }};
  return {sdk,calls,now:()=>now,change:x=>{now=x;}};
}
describe('original no-money-out TEST Charge lifecycle Events',()=>{
  it.each(['charge.succeeded','charge.updated'])(
    '%s verifies exact PaymentIntent/Charge provenance and replays safely',
    async type=>{
    const plan=make(type),f=fixture();
    expect(plan.steps.map(x=>x.type)).toEqual([
      'customer','payment_intent','charge','event'
    ]);
    verifyNativeCharge(plan,f.now(),rows);
    await ensureNativeChargeEvent(f.sdk,plan,rows,'rmcp_charge_test');
    verifyNativeCharge(plan,f.now(),rows,{final:true});
    const event={object:'event',id:'evt_CHARGE123',livemode:false,
      account,type,data:{object:f.now()}};
    expect(matchesNativeChargeEvent(event,plan,account,{
      id:chargeId,customer,paymentIntent:payment
    })).toBe(true);
    const mutations=f.calls.filter(x=>x==='update').length;
    await ensureNativeChargeEvent(f.sdk,plan,rows,'rmcp_charge_test');
    expect(f.calls.filter(x=>x==='update')).toHaveLength(mutations);
    expect(matchesNativeChargeEvent({...event,account:'acct_FOREIGN'},plan,
      account,{id:chargeId,customer,paymentIntent:payment})).toBe(false);
  });
  it('denies fake foreign, LIVE, refunded, unpaid or wrong amount Charge',()=>{
    const plan=make('charge.updated');
    for(const change of [
      {livemode:true},{customer:'cus_FOREIGN'},
      {payment_intent:'pi_FOREIGN'},{paid:false},
      {refunded:true},{amount:0},{currency:'eur'},{status:'failed'}
    ])expect(()=>verifyNativeCharge(plan,source(change),rows)).toThrow();
  });
  it('never updates a foreign source or post-refund Charge',async()=>{
    const plan=make('charge.updated'),f=fixture();
    f.change(source({payment_intent:'pi_FOREIGN'}));
    await expect(ensureNativeChargeEvent(f.sdk,plan,rows,
      'rmcp_charge_test')).rejects.toThrow();
    expect(f.calls).toEqual(['read']);
  });
});
