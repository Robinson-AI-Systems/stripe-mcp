import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses official Stripe file link create and retrieve endpoint',async()=>{
  const s=makeStripeClient({key,mode:'test'},{
    host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const link=await s.fileLinks.create({file:'file_FAKE1234',expires_at:1999999999});
  expect(link.object).toBe('file_link');
  expect((await s.fileLinks.retrieve('link_FAKE1234')).object).toBe('file_link');
});
