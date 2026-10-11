import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses pinned SDK native TEST top-up create/cancel with idempotency',async()=>{
  const s=makeStripeClient({key,mode:'test'},{
    host:'127.0.0.1',port:12111,protocol:'http',
    maxNetworkRetries:0,timeout:5000});
  expect((await s.topups.create({amount:8500,currency:'usd',
    source:'btok_us_verified',description:'Synthetic TEST balance top-up'},
    {idempotencyKey:'rmcp_topup_create_mock_1234'})).object).toBe('topup');
  expect((await s.topups.cancel('tu_FAKE1234',{},
    {idempotencyKey:'rmcp_topup_cancel_mock_1234'})).object).toBe('topup');
});
