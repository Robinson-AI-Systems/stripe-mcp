import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
describe('V-1b4a pinned SDK provider read shapes',()=>{
  it('retrieves a TEST payment and its charge',async()=>{
    expect((await stripe().paymentIntents.retrieve('pi_FAKE123')).object).toBe('payment_intent');
    expect((await stripe().charges.retrieve('ch_FAKE123')).object).toBe('charge');
  });
  it('queries Stripe dispute-created events',async()=>{
    const results=await stripe().events.list({type:'charge.dispute.created',limit:100});
    expect(results.object).toBe('list');
  });
});
