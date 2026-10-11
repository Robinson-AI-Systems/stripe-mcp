// V-1b1 test-only official Stripe SDK request shape on pinned stripe-mock.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const s=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',
  maxNetworkRetries:0,timeout:5000});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_dev_seed_advanced_1234'};
describe('V-1b1 pinned Stripe SDK TEST scenario endpoints',()=>{
  it('creates and independently retrieves a synthetic confirmed one-time PaymentIntent',async()=>{
    const c=s();
    expect((await c.paymentIntents.create({
      customer:'cus_FAKE1234',amount:3600,currency:'usd',
      payment_method:'pm_card_visa',confirm:true,metadata,
      description:'Synthetic tracked TEST store payment'
    },opts)).object).toBe('payment_intent');
    expect((await c.paymentIntents.retrieve('pi_FAKE1234')).object).toBe('payment_intent');
  });
  it('creates a trial subscription using current billing_mode and no upfront charge',async()=>{
    const c=s();
    expect((await c.subscriptions.create({
      customer:'cus_FAKE1234',items:[{price:'price_FAKE1234'}],
      collection_method:'charge_automatically',
      billing_mode:{type:'flexible'},payment_behavior:'error_if_incomplete',
      proration_behavior:'none',trial_period_days:7,metadata
    },opts)).object).toBe('subscription');
    expect((await c.subscriptions.retrieve('sub_FAKE1234')).object).toBe('subscription');
  });
  it('uses the official native trial cancellation request for canceled scenario',async()=>{
    const c=s();
    expect((await c.subscriptions.cancel('sub_FAKE1234',{invoice_now:false,prorate:false},opts)).object)
      .toBe('subscription');
  });
  it('supports a one-time USD Price on pinned Stripe SDK',async()=>{
    const c=s();
    expect((await c.prices.create({
      product:'prod_FAKE1234',unit_amount:3600,currency:'usd',metadata
    },opts)).object).toBe('price');
  });
});
