import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('calls pinned TEST Stripe disputes.close with empty params and stable idempotency',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  expect((await s.disputes.close('du_FAKE1234',{},
    {idempotencyKey:'rmcp_dispute_close_mock_1234'})).object).toBe('dispute');
  expect((await s.disputes.retrieve('du_FAKE1234')).object).toBe('dispute');
});
