import {describe,it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
const payout='po_FAKE1234';
const stripe=()=>makeStripeClient({key,mode:'test'},{
  host:'127.0.0.1',port:12111,protocol:'http',
  maxNetworkRetries:0,timeout:5000});
describe('G-1c1 pinned SDK payout write routes via stripe-mock',()=>{
  it('updates metadata and cancels a pending payout',async()=>{
    const s=stripe(),opts={idempotencyKey:'rmcp_payout_mock_1234'};
    expect((await s.payouts.update(payout,{metadata:{label:'TEST'}},opts))
      .object).toBe('payout');
    expect((await s.payouts.cancel(payout,{},opts)).object).toBe('payout');
  });
});
