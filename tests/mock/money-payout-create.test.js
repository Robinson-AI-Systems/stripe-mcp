import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses pinned SDK for bank retrieval and idempotent standard payout creation',async()=>{
  const s=makeStripeClient({key,mode:'test'},{
    host:'127.0.0.1',port:12111,protocol:'http',
    maxNetworkRetries:0,timeout:5000});
  expect((await s.accounts.retrieveExternalAccount('acct_FAKE1234',
    'ba_FAKE1234')).object).toBe('bank_account');
  expect((await s.payouts.create({amount:8500,currency:'usd',
    destination:'ba_FAKE1234',source_type:'card',method:'standard'},
    {idempotencyKey:'rmcp_payout_create_mock_1234'})).object).toBe('payout');
});
