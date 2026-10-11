import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('calls official pinned Stripe SDK payout reversal route with idempotency',async()=>{
  const s=makeStripeClient({key,mode:'test'},{
    host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  expect((await s.payouts.reverse('po_FAKE1234',{},
    {idempotencyKey:'rmcp_payout_reverse_mock_1234'})).object).toBe('payout');
});
