import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses the pinned balance transactions list request shape for TEST fee periods',async()=>{
  const s=makeStripeClient({key,mode:'test'},{
    host:'127.0.0.1',port:12111,protocol:'http',
    maxNetworkRetries:0,timeout:5000});
  const page=await s.balanceTransactions.list({limit:2,
    created:{gte:1700000000,lt:1700003600}});
  expect(page.object).toBe('list');
});
