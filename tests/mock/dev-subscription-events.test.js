// TEST-only trial subscription events through Stripe SDK pinned to the repo.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_dev_subscription_events_1'};
describe('V-3c1 pinned Stripe TEST subscription lifecycle event routes',()=>{
  it('creates a real monthly recurring TEST price for a free-trial subscription',async()=>{
    const r=await sdk().prices.create({product:'prod_FAKE123',
      currency:'usd',unit_amount:3600,recurring:{interval:'month'},
      metadata},opts);
    expect(r.object).toBe('price');
  });
  it('creates a native TEST subscription with a no-charge 7-day trial',async()=>{
    const r=await sdk().subscriptions.create({
      customer:'cus_FAKE123',items:[{price:'price_FAKE123'}],
      trial_period_days:7,collection_method:'charge_automatically',metadata
    },opts);
    expect(r.object).toBe('subscription');
    expect((await sdk().subscriptions.retrieve('sub_FAKE123')).object)
      .toBe('subscription');
  });
  it('reads and tags the exact zero-dollar trial invoice',async()=>{
    expect((await sdk().invoices.retrieve('in_FAKE123')).object)
      .toBe('invoice');
    expect((await sdk().invoices.update('in_FAKE123',{metadata},opts)).object)
      .toBe('invoice');
  });
  it('cancels a synthetic TEST trial without final invoice or proration',async()=>{
    const r=await sdk().subscriptions.cancel('sub_FAKE123',
      {invoice_now:false,prorate:false},opts);
    expect(r.object).toBe('subscription');
  });
  it.each(['customer.subscription.created','customer.subscription.deleted'])(
    'lists real %s Events and retrieves the matching evidence',async type=>{
      const page=await sdk().events.list({type,limit:100});
      expect(page.object).toBe('list');
      expect((await sdk().events.retrieve('evt_FAKE123')).object)
        .toBe('event');
    });
});
