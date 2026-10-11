// V-1a pinned official Stripe SDK catalog seeding routes via stripe-mock.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',
  maxNetworkRetries:0,timeout:5000});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_dev_seed_catalog_1'};
describe('V-1a current-native TEST catalog seeding SDK shape',()=>{
  it('creates and independently retrieves a metadata-tagged product',async()=>{
    const s=stripe(),p=await s.products.create({
      name:'RTC Test Product 1',metadata},opts);
    expect(p.object).toBe('product');
    expect((await s.products.retrieve('prod_FAKE1234')).object).toBe('product');
  });
  it('creates and retrieves a recurring USD price with its owning product',async()=>{
    const s=stripe(),p=await s.prices.create({
      product:'prod_FAKE1234',unit_amount:3600,currency:'usd',
      recurring:{interval:'month'},metadata
    },opts);
    expect(p.object).toBe('price');
    expect((await s.prices.retrieve('price_FAKE1234')).object).toBe('price');
  });
  it('creates and retrieves a synthetic TEST customer with run provenance',async()=>{
    const s=stripe(),c=await s.customers.create({
      name:'RTC Test Customer 1',
      email:'rtc-test+run_aaaaaaaaaaaaaaaaaaaaaaaa-1@example.test',
      metadata
    },opts);
    expect(c.object).toBe('customer');
    expect((await s.customers.retrieve('cus_FAKE1234')).object).toBe('customer');
  });
});
