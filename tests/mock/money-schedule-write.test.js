import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('issues pinned account-settings update shape (own-account authorization not assumed)',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  expect((await s.accounts.update('acct_FAKE1234',{
    settings:{payouts:{schedule:{interval:'daily'}}}},
    {idempotencyKey:'rmcp_schedule_mock_1234'})).object).toBe('account');
});
