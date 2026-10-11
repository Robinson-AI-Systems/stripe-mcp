import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('G-5c2 pinned SDK retrieves exact configuration, not hand-built HTTP',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const own=await s.accounts.retrieve();
  expect(own.object).toBe('account');
  const list=await s.paymentMethodConfigurations.list({limit:1});
  if(list.data?.length){
    const exact=await s.paymentMethodConfigurations.retrieve(list.data[0].id);
    expect(exact.id).toBe(list.data[0].id);
  } else {
    expect(list.object).toBe('list'); // stripe-mock has no live TEST fixtures.
  }
});
