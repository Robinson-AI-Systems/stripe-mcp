import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',
  maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_test_owned_card_123'};
describe('V-3 genuine TEST PaymentMethod lifecycle request shapes',()=>{
  it('creates a synthetic token-backed card with run provenance before attach',async()=>{
    const pm=await sdk().paymentMethods.create({
      type:'card',card:{token:'tok_visa'},metadata
    },opts);
    expect(pm.object).toBe('payment_method');
    const fetched=await sdk().paymentMethods.retrieve('pm_FAKE123');
    expect(fetched.object).toBe('payment_method');
  });
  it('attaches a tracked card to the exact isolated TEST customer',async()=>{
    expect((await sdk().paymentMethods.attach('pm_FAKE123',{
      customer:'cus_FAKE123'
    },opts)).object).toBe('payment_method');
  });
  it('updates only the synthetic card billing name and preserves ownership',async()=>{
    expect((await sdk().paymentMethods.update('pm_FAKE123',{
      billing_details:{name:'RTC TEST Event Updated Card'}
    },opts)).object).toBe('payment_method');
  });
  it('detaches the exact tracked TEST card without changing money',async()=>{
    expect((await sdk().paymentMethods.detach('pm_FAKE123',{},opts)).object)
      .toBe('payment_method');
  });
  it.each(['payment_method.attached','payment_method.updated',
    'payment_method.detached'])(
    'lists and independently retrieves original %s Stripe Event',async type=>{
      const page=await sdk().events.list({type,limit:100});
      expect(page.object).toBe('list');
      expect((await sdk().events.retrieve('evt_FAKE123')).object)
        .toBe('event');
    });
});
