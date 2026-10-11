import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('G-4e pinned Stripe-native webhook update/delete parameters',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const id='we_FAKE1234';
  const updated=await s.webhookEndpoints.update(id,{description:'Updated TEST hook'},
    {idempotencyKey:'rmcp_webhook_update_mock_1234'});
  expect(updated.object).toBe('webhook_endpoint');
  const deleted=await s.webhookEndpoints.del(id,{},
    {idempotencyKey:'rmcp_webhook_delete_mock_1234'});
  expect(deleted.deleted).toBe(true);
});
