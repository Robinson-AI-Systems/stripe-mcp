// V-1b4b pinned Stripe SDK request shapes for a real paid TEST subscription.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const s=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_dev_active_subscription_123'};
describe('V-1b4b active TEST subscription and invoice provenance',()=>{
  it('creates a customer with default test card attached for subscription billing',async()=>{
    const c=await s().customers.create({
      name:'RTC Test Customer 1',email:'rtc-test+active@example.test',
      payment_method:'pm_card_visa',
      invoice_settings:{default_payment_method:'pm_card_visa'},metadata
    },opts);
    expect(c.object).toBe('customer');
  });
  it('creates an immediately payable subscription without trial days',async()=>{
    const sub=await s().subscriptions.create({
      customer:'cus_FAKE1234',items:[{price:'price_FAKE1234'}],
      collection_method:'charge_automatically',
      billing_mode:{type:'flexible'},payment_behavior:'error_if_incomplete',
      proration_behavior:'none',metadata
    },opts);
    expect(sub.object).toBe('subscription');
  });
  it('tags only the linked TEST invoice and verifies the provider object',async()=>{
    const stripe=s();
    expect((await stripe.invoices.update('in_FAKE1234',{metadata},opts)).object).toBe('invoice');
    expect((await stripe.invoices.retrieve('in_FAKE1234')).object).toBe('invoice');
  });
});
