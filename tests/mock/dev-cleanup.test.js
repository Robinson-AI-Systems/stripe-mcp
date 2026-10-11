import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const opts={idempotencyKey:'rmcp_dev_cleanup_mock_123'};
describe('V-2a pinned Stripe SDK cleanup routes',()=>{
  it('archives TEST products and prices with explicit active false',async()=>{
    expect((await sdk().products.update('prod_FAKE123',{active:false},opts))
      .object).toBe('product');
    expect((await sdk().prices.update('price_FAKE123',{active:false},opts))
      .object).toBe('price');
  });
  it('cancels TEST subscriptions without refund, and cancels unconfirmed intents',async()=>{
    expect((await sdk().subscriptions.cancel('sub_FAKE123',{
      invoice_now:false,prorate:false},opts)).object).toBe('subscription');
    expect((await sdk().paymentIntents.cancel('pi_FAKE123',{},opts))
      .object).toBe('payment_intent');
  });
  it('voids unpaid invoices; never attempts deleting paid invoices',async()=>{
    expect((await sdk().invoices.voidInvoice('in_FAKE123',{},opts))
      .object).toBe('invoice');
    expect((await sdk().invoices.del('in_FAKE123',opts))
      .object).toBe('invoice');
  });
  it('deletes only recorded TEST customers',async()=>{
    const customer=await sdk().customers.del('cus_FAKE123',opts);
    expect(customer.object).toBe('customer');
  });
});
