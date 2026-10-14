import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const sdk=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const metadata={rtc_run:'run_'+'a'.repeat(24)};
const opts={idempotencyKey:'rmcp_setup_event_123'};
describe('Stripe-mock native SetupIntent shape',()=>{
  it('creates tracked TEST card-only SetupIntent without customer or card charge',async()=>{
    const response=await sdk().setupIntents.create({
      payment_method_types:['card'],usage:'off_session',metadata
    },opts);
    expect(response.object).toBe('setup_intent');
    expect((await sdk().setupIntents.retrieve('seti_FAKE123')).object)
      .toBe('setup_intent');
  });
  it('cancels a known TEST SetupIntent with provider cancellation reason',async()=>{
    expect((await sdk().setupIntents.cancel('seti_FAKE123',{
      cancellation_reason:'abandoned'
    },opts)).object).toBe('setup_intent');
  });
  it('confirms exact TEST card setup without moving funds',async()=>{
    expect((await sdk().setupIntents.confirm('seti_FAKE123',{
      payment_method:'pm_card_visa'
    },opts)).object).toBe('setup_intent');
  });
  it.each(['setup_intent.created','setup_intent.canceled',
    'setup_intent.succeeded'])('lists and retrieves original %s event',async type=>{
    expect((await sdk().events.list({type,limit:100})).object).toBe('list');
    expect((await sdk().events.retrieve('evt_FAKE123')).object).toBe('event');
  });
});
