// V-1b3 test dispute-card and unconfirmed ACH intent SDK route validation.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',
  maxNetworkRetries:0,timeout:5000});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_test_async_scenario_1234'};
describe('V-1b3 native Stripe TEST async-event fixtures',()=>{
  it('creates a dispute-triggering TEST card payment, without claiming a dispute exists',async()=>{
    const p=await stripe().paymentIntents.create({
      customer:'cus_FAKE1234',amount:3600,currency:'usd',
      payment_method:'pm_card_createDispute',confirm:true,metadata,
      description:'TEST card selected for later dispute event'
    },opts);
    expect(p.object).toBe('payment_intent');
  });
  it('creates an unconfirmed ACH-capable intent, not an actual bank debit',async()=>{
    const p=await stripe().paymentIntents.create({
      customer:'cus_FAKE1234',amount:3600,currency:'usd',
      payment_method:'pm_usBankAccount',
      payment_method_types:['us_bank_account'],confirm:false,metadata,
      description:'Unconfirmed TEST ACH-capable setup, no bank debit'
    },opts);
    expect(p.object).toBe('payment_intent');
  });
});
