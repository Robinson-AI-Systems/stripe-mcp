import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
describe('V-3c3a native synthetic failed-payment request shapes',()=>{
  it('creates a durable TEST intent without requesting any capture',async()=>{
    const obj=await sdk().paymentIntents.create({
      customer:'cus_FAKE123',amount:3600,currency:'usd',
      confirm:false,metadata,description:'Tracked synthetic TEST event charge'
    },{idempotencyKey:'rmcp_failed_pi_create'});
    expect(obj.object).toBe('payment_intent');
  });
  it('uses actual Stripe TEST decline payment method on native confirm',async()=>{
    // stripe-mock confirms request schema but cannot simulate the StripeCardError.
    // Real handler verifies provider failed state rather than relying on errors.
    try{
      const result=await sdk().paymentIntents.confirm('pi_FAKE123',{
        payment_method:'pm_card_chargeCustomerFail'
      },{idempotencyKey:'rmcp_failed_pi_confirmation'});
      expect(result.object).toBe('payment_intent');
    }catch(error){
      expect(error.type).toBe('StripeCardError');
    }
  });
  it('reads exact provider payment state and the independently retrievable Event',async()=>{
    expect((await sdk().paymentIntents.retrieve('pi_FAKE123')).object)
      .toBe('payment_intent');
    const page=await sdk().events.list({
      type:'payment_intent.payment_failed',limit:100
    });
    expect(page.object).toBe('list');
    expect((await sdk().events.retrieve('evt_FAKE123')).object).toBe('event');
  });
});
