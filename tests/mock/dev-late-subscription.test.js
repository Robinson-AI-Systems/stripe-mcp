// Pinned Stripe SDK call shapes for the actual clocked overdue TEST scenario.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_test_overdue_sub_1234'};
describe('V-1b4d Stripe test-clock overdue request shapes',()=>{
  it('creates a time-frozen TEST customer with attachable decline-on-charge card',async()=>{
    const c=await stripe().customers.create({
      name:'RTC Test Customer 1',test_clock:'clock_FAKE123',
      payment_method:'pm_card_chargeCustomerFail',
      invoice_settings:{default_payment_method:'pm_card_chargeCustomerFail'},
      metadata
    },opts);
    expect(c.object).toBe('customer');
  });
  it('creates the trial subscription without claiming overdue status',async()=>{
    const sub=await stripe().subscriptions.create({
      customer:'cus_FAKE123',items:[{price:'price_FAKE123'}],
      collection_method:'charge_automatically',
      billing_mode:{type:'flexible'},payment_behavior:'error_if_incomplete',
      proration_behavior:'none',trial_period_days:7,metadata
    },opts);
    expect(sub.object).toBe('subscription');
  });
  it('tags the actual first and later invoice using pinned Stripe update',async()=>{
    const i=await stripe().invoices.update('in_FAKE123',{metadata},opts);
    expect(i.object).toBe('invoice');
  });
  it('advances the attached TEST clock by eight days but does not treat response as final',async()=>{
    const c=await stripe().testHelpers.testClocks.advance('clock_FAKE123',{
      frozen_time:1700000000+8*86400
    },opts);
    expect(c.object).toBe('test_helpers.test_clock');
  });
});
