import {describe,it,expect} from 'vitest';
import {findActualDispute,verifiedDisputeObject,matchesDisputeEvent}
  from '../../src/dev/triggers-disputes.js';
const run='run_'+'a'.repeat(24);
const plan={type:'charge.dispute.created',runId:run};
const account='acct_FAKE123';
const rows=new Map([
  ['customer_1',{object_id:'cus_FAKE123'}],
  ['payment_intent_1',{object_id:'pi_FAKE123'}],
  ['charge_1',{object_id:'ch_FAKE123'}]
]);
const charge=(extra={})=>({
  id:'ch_FAKE123',object:'charge',livemode:false,
  payment_intent:'pi_FAKE123',customer:'cus_FAKE123',
  amount:3600,currency:'usd',paid:true,status:'succeeded',
  disputed:false,...extra
});
const dispute=(extra={})=>({
  id:'du_FAKE123',object:'dispute',livemode:false,
  charge:'ch_FAKE123',payment_intent:'pi_FAKE123',
  amount:3600,currency:'usd',metadata:{},...extra
});
const event=(d=dispute())=>({
  id:'evt_FAKE123',object:'event',livemode:false,
  type:'charge.dispute.created',account,
  data:{object:d}
});
describe('V-3c3b authentic provider-linked dispute',()=>{
  it('does not claim a dispute when a TEST card payment succeeded only',async()=>{
    const stripe={charges:{retrieve:async()=>charge()},
      disputes:{list:async()=>{throw Error('Cannot list before dispute');}}};
    expect(await findActualDispute(stripe,plan,rows)).toBeNull();
  });
  it('requires charge filter and provider read-back before accepting dispute',async()=>{
    let reads=0;
    const stripe={charges:{retrieve:async()=>charge({disputed:true})},
      disputes:{
        list:async a=>{
          expect(a.charge).toBe('ch_FAKE123');
          expect(a.limit).toBe(100);
          return {data:[dispute()],has_more:false};
        },
        retrieve:async id=>{
          reads++;expect(id).toBe('du_FAKE123');return dispute();
        }
      }
    };
    expect((await findActualDispute(stripe,plan,rows)).id)
      .toBe('du_FAKE123');
    expect(reads).toBe(1);
  });
  it('rejects a dispute with a foreign linked charge, amount or PaymentIntent',()=>{
    for(const altered of [
      {charge:'ch_FOREIGN'},{amount:5500},{payment_intent:'pi_FOREIGN'},
      {livemode:true}
    ])expect(()=>verifiedDisputeObject(plan,dispute(altered),rows)).toThrow();
  });
  it('only accepts the original Stripe Event with exact charge and dispute',()=>{
    const target={type:'dispute',id:'du_FAKE123',
      charge:'ch_FAKE123',paymentIntent:'pi_FAKE123'};
    expect(matchesDisputeEvent(event(),plan,account,target)).toBe(true);
    for(const changed of [
      {id:'du_FOREIGN'},{charge:'ch_FOREIGN'},
      {amount:4000},{payment_intent:'pi_FOREIGN'},{livemode:true}
    ])expect(matchesDisputeEvent(event(dispute(changed)),plan,account,target))
      .toBe(false);
    expect(matchesDisputeEvent({...event(),account:'acct_OTHER'},
      plan,account,target)).toBe(false);
  });
});
