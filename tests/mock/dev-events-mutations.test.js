import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const opts={idempotencyKey:'rmcp_dev_mutation_events_123'};
describe('V-3b actual Stripe TEST mutation event request shapes',()=>{
  it('updates a synthetic customer and product to emit native updated events',async()=>{
    expect((await sdk().customers.update('cus_FAKE123',{
      description:'RTC Event Updated Customer'},opts)).object).toBe('customer');
    expect((await sdk().products.update('prod_FAKE123',{
      name:'RTC Event Updated Product'},opts)).object).toBe('product');
  });
  it('updates only the safe TEST price nickname, retaining price and metadata',async()=>{
    expect((await sdk().prices.update('price_FAKE123',{
      nickname:'RTC Event Updated Price'},opts)).object).toBe('price');
  });
  it('creates and explicitly cancels an unconfirmed TEST payment, without charging',async()=>{
    const pi=await sdk().paymentIntents.create({
      customer:'cus_FAKE123',amount:3600,currency:'usd',
      payment_method:'pm_card_visa',confirm:false,
      metadata:{rtc_run:'run_'+'a'.repeat(24)},
      description:'Tracked synthetic TEST event charge'
    },opts);
    expect(pi.object).toBe('payment_intent');
    expect((await sdk().paymentIntents.cancel('pi_FAKE123',{},opts))
      .object).toBe('payment_intent');
  });
  it('lists the exact four native TEST mutation event types',async()=>{
    for(const type of ['customer.updated','product.updated',
      'price.updated','payment_intent.canceled']){
      const page=await sdk().events.list({type,limit:100});
      expect(page.object).toBe('list');
    }
  });
});
