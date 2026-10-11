// Native Stripe 2026-09-30.endive TEST bank confirmation request shape.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
describe('V-1b4e Stripe TEST ACH confirmation',()=>{
  it('accepts an online TEST-only mandate and idempotent payment confirmation',async()=>{
    const pi=await sdk().paymentIntents.confirm('pi_FAKE123',{
      payment_method:'pm_usBankAccount',
      mandate_data:{customer_acceptance:{type:'online',
        online:{ip_address:'127.0.0.1',user_agent:'RTC synthetic TEST only'}}}
    },{idempotencyKey:'rmcp_ach_synthetic_123'});
    expect(pi.object).toBe('payment_intent');
  });
});
