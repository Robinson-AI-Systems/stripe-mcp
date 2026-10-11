import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses pinned TEST Stripe dispute draft update with explicitly false submit flag',async()=>{
  const s=makeStripeClient({key,mode:'test'},{
    host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const updated=await s.disputes.update('du_FAKE1234',{
    evidence:{product_description:'Verified delivery'},submit:false});
  expect(updated.object).toBe('dispute');
  expect((await s.disputes.retrieve('du_FAKE1234')).object).toBe('dispute');
});
