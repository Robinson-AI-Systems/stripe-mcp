import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',
  maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24),rtc_charge_event:'1'};
const opts={idempotencyKey:'rmcp_charge_event_test_123'};
describe('pinned Stripe TEST original Charge event request shapes',()=>{
  it('creates run-tagged original synthetic TEST PaymentIntent only',async()=>{
    expect((await sdk().paymentIntents.create({
      customer:'cus_FAKE123',amount:3600,currency:'usd',
      payment_method:'pm_card_visa',confirm:true,metadata,
      description:'Tracked synthetic TEST event charge'
    },opts)).object).toBe('payment_intent');
  });
  it('independently reads and safely describes the exact existing TEST Charge',async()=>{
    expect((await sdk().charges.retrieve('ch_FAKE123')).object).toBe('charge');
    expect((await sdk().charges.update('ch_FAKE123',{
      description:'RTC Synthetic TEST Updated Charge'
    },opts)).object).toBe('charge');
  });
  it.each(['charge.succeeded','charge.updated'])(
    'lists and independently retrieves original %s',async type=>{
    expect((await sdk().events.list({type,limit:100})).object).toBe('list');
    expect((await sdk().events.retrieve('evt_FAKE123')).object).toBe('event');
  });
});
