import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('G-5b uses pinned native TEST account capability GET (not a constructed HTTP call)',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const account=await s.accounts.retrieve();
  expect(account.id).toMatch(/^acct_/);
  const capabilities=await s.accounts.listCapabilities(account.id);
  expect(capabilities.object).toBe('list');
  expect(Array.isArray(capabilities.data)).toBe(true);
});
