import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('routes TEST Radar list deletion/item create/item deletion through pinned SDK',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const opts={idempotencyKey:'rmcp_radar_list_lifecycle_mock'};
  expect((await s.radar.valueLists.del('rsl_FAKE1234',{},opts)).deleted).toBe(true);
  expect((await s.radar.valueListItems.create({
    value_list:'rsl_FAKE1234',value:'private@example.com'},opts))
    .object).toBe('radar.value_list_item');
  expect((await s.radar.valueListItems.del('rsli_FAKE1234',{},opts)).deleted).toBe(true);
});
