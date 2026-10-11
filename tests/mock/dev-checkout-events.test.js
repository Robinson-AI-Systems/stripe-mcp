import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_test_hosted_checkout_create'};
describe('V-3c3d Stripe-hosted TEST Checkout API shape',()=>{
  it('creates real hosted TEST Checkout in payment mode with run-owned PI',async()=>{
    const session=await stripe().checkout.sessions.create({
      customer:'cus_FAKE123',mode:'payment',
      payment_method_types:['card'],line_items:[{
        price:'price_FAKE123',quantity:1
      }],
      success_url:'https://example.com/stripe-test-success',
      cancel_url:'https://example.com/stripe-test-cancel',
      client_reference_id:metadata.rtc_run,
      metadata,payment_intent_data:{metadata}
    },opts);
    expect(session.object).toBe('checkout.session');
  });
  it('reads and expires a native TEST Checkout Session',async()=>{
    const session=await stripe().checkout.sessions.retrieve('cs_test_FAKE123');
    expect(session.object).toBe('checkout.session');
    const expired=await stripe().checkout.sessions.expire(
      'cs_test_FAKE123',{},opts);
    expect(expired.object).toBe('checkout.session');
  });
  it('independently reads Checkout-generated PaymentIntent and true Event',async()=>{
    expect((await stripe().paymentIntents.retrieve('pi_FAKE123')).object)
      .toBe('payment_intent');
    const events=await stripe().events.list({
      type:'checkout.session.completed',limit:100
    });
    expect(events.object).toBe('list');
    expect((await stripe().events.retrieve('evt_FAKE123')).object).toBe('event');
  });
});
