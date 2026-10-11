import {it,expect} from 'vitest';
import {makeStripeClient} from '../../src/stripe/client.js';
const key=['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_');
it('G-4d uses native pinned Stripe webhook endpoint create request',async()=>{
  const s=makeStripeClient({key,mode:'test'},
    {host:'127.0.0.1',port:12111,protocol:'http',maxNetworkRetries:0,timeout:5000});
  const result=await s.webhookEndpoints.create({
    url:'https://hooks.public-domain.org/stripe/events',
    enabled_events:['invoice.paid']
  },{idempotencyKey:'rmcp_webhook_create_mock_1234'});
  expect(result.object).toBe('webhook_endpoint');
});
