import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses pinned Stripe TEST dispute list and retrieval request shapes',async()=>{
  const s=makeStripeClient({key,mode:'test'},{
    host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  expect((await s.disputes.list({limit:2})).object).toBe('list');
  expect((await s.disputes.retrieve('dp_FAKE1234')).object).toBe('dispute');
});
