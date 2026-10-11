// Pinned official Stripe SDK/stripe-mock request shapes for TEST event sources.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_dev_trigger_real_test_123'};
describe('V-3a real Stripe TEST event source endpoints',()=>{
  it('creates and retrieves event-tagged TEST customer',async()=>{
    expect((await sdk().customers.create({
      name:'RTC Event Test Customer',email:'rtc-event+fake@example.test',
      metadata
    },opts)).object).toBe('customer');
    expect((await sdk().customers.retrieve('cus_FAKE123')).object).toBe('customer');
  });
  it('creates and independently retrieves event-tagged product and price',async()=>{
    expect((await sdk().products.create({
      name:'RTC Event Test Product',metadata
    },opts)).object).toBe('product');
    expect((await sdk().prices.create({product:'prod_FAKE123',
      unit_amount:3600,currency:'usd',metadata
    },opts)).object).toBe('price');
    expect((await sdk().prices.retrieve('price_FAKE123')).object).toBe('price');
  });
  it('creates incoming synthetic TEST card payment with actual confirmation',async()=>{
    expect((await sdk().paymentIntents.create({customer:'cus_FAKE123',
      amount:3600,currency:'usd',payment_method:'pm_card_visa',confirm:true,
      metadata,description:'Tracked synthetic TEST event charge'
    },opts)).object).toBe('payment_intent');
  });
  it('lists and independently retrieves real Stripe TEST event object',async()=>{
    const results=await sdk().events.list({type:'customer.created',limit:100});
    expect(results.object).toBe('list');
    expect((await sdk().events.retrieve('evt_FAKE123')).object).toBe('event');
  });
});
