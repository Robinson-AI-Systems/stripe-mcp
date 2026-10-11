import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('calls official TEST reviews.approve and Radar list create routes with pinned SDK',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  expect((await s.reviews.approve('prv_FAKE1234',{},
    {idempotencyKey:'rmcp_radar_approve_mock_123'})).object).toBe('review');
  expect((await s.radar.valueLists.create({
    name:'Test fraud list',alias:'test_fraud_list',item_type:'email'},
    {idempotencyKey:'rmcp_radar_list_mock_123'})).object).toBe('radar.value_list');
});
