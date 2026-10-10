import { describe, expect, it } from 'vitest';
import Stripe from 'stripe';
import { makeFakeStripe, stripeError } from '../../test/helpers/fake-stripe.js';

describe('fake Stripe', () => {
  it('records nested paths, arguments and idempotency options', async () => {
    const { stripe, calls, when } = makeFakeStripe();
    when('checkout.sessions.create').resolves({ id: 'cs_test_fake' });
    expect(await stripe.checkout.sessions.create({ mode: 'payment' }, { idempotencyKey: 'same-key' }))
      .toEqual({ id: 'cs_test_fake' });
    expect(calls).toEqual([{ path: 'checkout.sessions.create', params: { mode: 'payment' }, options: { idempotencyKey: 'same-key' } }]);
  });
  it('throws when a call is not configured', async () => {
    const { stripe } = makeFakeStripe();
    await expect(stripe.customers.create({})).rejects.toThrow(/Unconfigured fake Stripe call/);
  });
  it('throws configured official Stripe error subclasses', async () => {
    const { stripe, when } = makeFakeStripe();
    const error = stripeError('invalid_request_error', { message: 'A bad parameter' });
    when('customers.list').rejects(error);
    await expect(stripe.customers.list()).rejects.toBeInstanceOf(Stripe.errors.StripeInvalidRequestError);
  });
});
