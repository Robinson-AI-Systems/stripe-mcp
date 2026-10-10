import { expect, it } from 'vitest';
import { makeStripeClient } from '../../src/stripe/client.js';
it('submits a real SDK nested subscription item against isolated stripe-mock', async () => {
  const stripe = makeStripeClient({ key: ['sk','test','FAKEFAKEFAKEFAKEFAKEFAKE'].join('_'), mode: 'test' },
    { host: '127.0.0.1', port: 12111, protocol: 'http', maxNetworkRetries: 0 });
  const result = await stripe.subscriptions.create({
    customer: 'cus_test_fixture', items: [{ price: 'price_test_fixture', quantity: 2 }]
  }, { idempotencyKey: 'rmcp_test_nested_subscriptions' });
  expect(result.id).toMatch(/^sub_/);
});
