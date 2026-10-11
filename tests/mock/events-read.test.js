import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses pinned native Event list/retrieve and delivery filter',async()=>{
  const stripe=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  expect((await stripe.events.list({limit:2,delivery_success:false})).object).toBe('list');
  expect((await stripe.events.retrieve('evt_FAKE1234')).object).toBe('event');
  expect((await stripe.events.list({limit:2,type:'charge.succeeded'})).object).toBe('list');
});
