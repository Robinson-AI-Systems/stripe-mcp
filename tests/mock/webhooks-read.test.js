import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('G-4b native webhook endpoint list and retrieve request shapes',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  expect((await s.webhookEndpoints.list({limit:2})).object).toBe('list');
  expect((await s.webhookEndpoints.retrieve('we_FAKE1234')).object)
    .toBe('webhook_endpoint');
});
