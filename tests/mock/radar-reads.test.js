import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('uses official pinned TEST Radar list routes without write calls',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  for(const get of [
    ()=>s.radar.earlyFraudWarnings.list({limit:2}),
    ()=>s.reviews.list({limit:2}),
    ()=>s.radar.valueLists.list({limit:2}),
    ()=>s.radar.valueListItems.list({value_list:'rsl_FAKE1234',limit:2})
  ])expect((await get()).object).toBe('list');
});
