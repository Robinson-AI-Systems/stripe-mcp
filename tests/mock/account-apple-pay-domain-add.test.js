import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('G-5d2 pinned TEST SDK resolves native payment-method domain listing and create request shape',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const page=await s.paymentMethodDomains.list({domain_name:'payments.example.com',limit:10});
  expect(page.object).toBe('list');
  // This test calls no provider mutation; the native method must exist in the pinned SDK.
  expect(typeof s.paymentMethodDomains.create).toBe('function');
});
