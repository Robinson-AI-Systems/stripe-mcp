// V-1b2 official pinned Stripe SDK test-refund request and read-back.
import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',
  maxNetworkRetries:0,timeout:5000});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_dev_seed_refund_1234'};
describe('V-1b2 pinned native TEST refund API',()=>{
  it('reads the original PaymentIntent and charge before any refund write',async()=>{
    const s=stripe();
    expect((await s.paymentIntents.retrieve('pi_FAKE1234')).object).toBe('payment_intent');
    expect((await s.charges.retrieve('ch_FAKE1234')).object).toBe('charge');
  });
  it('creates a fully specified TEST charge refund, then retrieves it',async()=>{
    const s=stripe();
    expect((await s.refunds.create({
      charge:'ch_FAKE1234',amount:8500,
      reason:'requested_by_customer',metadata
    },opts)).object).toBe('refund');
    expect((await s.refunds.retrieve('re_FAKE1234')).object).toBe('refund');
  });
});
