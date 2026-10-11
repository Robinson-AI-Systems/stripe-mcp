import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('G-4c uses native pinned-SDK webhook enabled_events update',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const result=await s.webhookEndpoints.update('we_FAKE1234',
    {enabled_events:['invoice.paid','charge.succeeded']},
    {idempotencyKey:'rmcp_webhook_add_events_mock_1234'});
  expect(result.object).toBe('webhook_endpoint');
});
