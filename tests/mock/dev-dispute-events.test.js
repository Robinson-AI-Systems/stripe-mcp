import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000
});
const opts={idempotencyKey:'rmcp_test_dispute_create'};
describe('V-3c3b native TEST dispute event request shapes',()=>{
  it('charges only the synthetic TEST dispute-triggering payment method',async()=>{
    const pi=await stripe().paymentIntents.create({
      customer:'cus_FAKE123',amount:3600,currency:'usd',
      payment_method:'pm_card_createDispute',confirm:true,
      description:'Tracked synthetic TEST event charge',
      metadata:{rtc_run:'run_'+'a'.repeat(24)}
    },opts);
    expect(pi.object).toBe('payment_intent');
  });
  it('retrieves exact linked Charge and lists/reads provider Disputes',async()=>{
    expect((await stripe().charges.retrieve('ch_FAKE123')).object).toBe('charge');
    const listed=await stripe().disputes.list({
      charge:'ch_FAKE123',limit:100
    });
    expect(listed.object).toBe('list');
    expect((await stripe().disputes.retrieve('du_FAKE123')).object)
      .toBe('dispute');
  });
  it('lists and independently retrieves exact provider-native created event',async()=>{
    const page=await stripe().events.list({
      type:'charge.dispute.created',limit:100
    });
    expect(page.object).toBe('list');
    expect((await stripe().events.retrieve('evt_FAKE123')).object).toBe('event');
  });
});
