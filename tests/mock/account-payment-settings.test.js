import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('G-5c1 pinned TEST SDK uses native payment method configurations GET',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const own=await s.accounts.retrieve();
  expect(own.object).toBe('account');
  const list=await s.paymentMethodConfigurations.list({limit:2});
  expect(list.object).toBe('list');
  expect(Array.isArray(list.data)).toBe(true);
});
