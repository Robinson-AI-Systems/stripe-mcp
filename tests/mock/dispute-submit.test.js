import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses pinned TEST disputes.update with submit:true, no evidence mutation',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const result=await s.disputes.update('du_FAKE1234',{submit:true},
    {idempotencyKey:'rmcp_submit_test_mock_1234'});
  expect(result.object).toBe('dispute');
  expect((await s.disputes.retrieve('du_FAKE1234')).object).toBe('dispute');
});
