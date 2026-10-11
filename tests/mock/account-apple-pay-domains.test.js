import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('G-5d1 pinned TEST SDK supports native paymentMethodDomains list request',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const own=await s.accounts.retrieve();
  expect(own.object).toBe('account');
  const page=await s.paymentMethodDomains.list({limit:2});
  expect(page.object).toBe('list');
  expect(Array.isArray(page.data)).toBe(true);
});
