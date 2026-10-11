import {describe,it,expect} from 'vitest';
import {verifyFailedPayment,ensureFailedPayment,matchesFailedPaymentEvent}
  from '../../src/dev/triggers-failures.js';

const plan={type:'payment_intent.payment_failed',
  runId:'run_'+'a'.repeat(24)};
const customer='cus_FAKE123';
const source=(extra={})=>({
  id:'pi_FAKE123',object:'payment_intent',livemode:false,
  metadata:{rtc_run:plan.runId},customer,
  amount:3600,amount_received:0,currency:'usd',
  status:'requires_payment_method',last_payment_error:null,...extra
});
const decline=()=>source({last_payment_error:{
  code:'card_declined',type:'card_error'
}});
describe('V-3c3a independent genuine Stripe decline evidence',()=>{
  it('does not confuse a newly created no-method intent with a failed attempt',()=>{
    expect(()=>verifyFailedPayment(plan,source(),customer)).not.toThrow();
    expect(()=>verifyFailedPayment(plan,source(),customer,true))
      .toThrow(/declined TEST card attempt/);
    expect(matchesFailedPaymentEvent(plan,source(),{
      id:'pi_FAKE123',customer})).toBe(false);
  });
  it('confirms the recorded intent once and retrieves actual failed state',async()=>{
    let state=source(),confirms=0,reads=0;
    const stripe={paymentIntents:{
      confirm:async(id,p,options)=>{
        confirms++;
        expect(id).toBe('pi_FAKE123');
        expect(p).toEqual({payment_method:'pm_card_chargeCustomerFail'});
        expect(options.idempotencyKey).toBe('rmcp_test_declined_confirmation');
        state=decline();
        throw Object.assign(new Error('declined'),{code:'card_declined'});
      },
      retrieve:async(id)=>{
        reads++;
        expect(id).toBe('pi_FAKE123');
        return state;
      }
    }};
    await ensureFailedPayment(stripe,plan,state,customer,'rmcp_test');
    await ensureFailedPayment(stripe,plan,state,customer,'rmcp_test');
    expect(confirms).toBe(1);
    expect(reads).toBe(2);
    expect(matchesFailedPaymentEvent(plan,state,{
      id:'pi_FAKE123',customer})).toBe(true);
  });
  it('rejects unconfirmed, foreign, paid and uncoded attempts',()=>{
    const target={id:'pi_FAKE123',customer};
    expect(matchesFailedPaymentEvent(plan,source({status:'succeeded',
      amount_received:3600}),target)).toBe(false);
    expect(matchesFailedPaymentEvent(plan,decline(),{
      ...target,id:'pi_FOREIGN'})).toBe(false);
    expect(matchesFailedPaymentEvent(plan,decline(),{
      ...target,customer:'cus_FOREIGN'})).toBe(false);
    expect(matchesFailedPaymentEvent(plan,source({metadata:{
      rtc_run:'run_FOREIGN'},last_payment_error:{code:'card_declined'}}),
    target)).toBe(false);
  });
  it('does not treat provider outage as a real TEST decline',async()=>{
    const stripe={paymentIntents:{
      confirm:async()=>{throw Error('network unavailable');},
      retrieve:async()=>decline()
    }};
    await expect(ensureFailedPayment(stripe,plan,source(),customer,
      'rmcp_test')).rejects.toThrow(/network unavailable/);
  });
  it('rejects provider return without independently verified decline',async()=>{
    const stripe={paymentIntents:{
      confirm:async()=>source(),
      retrieve:async()=>source()
    }};
    await expect(ensureFailedPayment(stripe,plan,source(),customer,
      'rmcp_test')).rejects.toThrow(/declined TEST card attempt/);
  });
});
