import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('G-5a native own-account GET uses the pinned Stripe SDK request path',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const response=await s.accounts.retrieve();
  expect(response.object).toBe('account');
  expect(response.id).toMatch(/^acct_/);
});
