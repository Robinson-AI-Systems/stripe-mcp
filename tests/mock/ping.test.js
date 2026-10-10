import { expect, it } from 'vitest';
import Stripe from 'stripe';

it('lists customers using the real Stripe library against local stripe-mock', async () => {
  const client = new Stripe(('sk_' + 'test_' + 'FAKE'.repeat(6)), {
    apiVersion: '2026-09-30.endive',
    host: '127.0.0.1', port: 12111, protocol: 'http',
    maxNetworkRetries: 0, timeout: 5000
  });
  const page = await client.customers.list({ limit: 1 });
  expect(page.object).toBe('list');
  expect(Array.isArray(page.data)).toBe(true);
});
