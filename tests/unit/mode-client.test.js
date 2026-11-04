// Owner-obedience V2 (shared): the one mode-aware provider-client seam.
// TEST resolution must be the historical behavior of the three replaced
// helpers; LIVE resolution must go through the verified selected-account
// path only; and the seam alone must not open LIVE execution in the
// payment/checkout modules, whose own wrapper refusals stay in place
// until their family conversions.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { modeClient } from '../../src/tools/account-mode.js';
import { client } from '../../src/tools/billing-shared.js';
import { createFakeDb } from '../../test/helpers/fake-db.js';
import { makePaymentWrite } from '../../src/tools/payment-writes.js';
import { makeCheckoutWrite } from '../../src/tools/checkout-writes.js';

const parse = r => JSON.parse(r.content[0].text);
const testCtx = stripe => ({ connection: { stripeAccount: 'acct_FAKE', mode: 'test', profile: 'full' },
  services: { stripeForConnection: async () => stripe } });

describe('V2 shared modeClient seam (fake provider only)', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('TEST resolution returns the connection service client, unchanged', async () => {
    const stripe = { marker: 'test-client' };
    await expect(modeClient(testCtx(stripe))).resolves.toBe(stripe);
    await expect(client(testCtx(stripe))).resolves.toBe(stripe);
  });
  it('TEST refusal is the historical one when the service is unavailable or the mode is neither', async () => {
    await expect(modeClient({ connection: { mode: 'test' }, services: {} }))
      .rejects.toThrow('TEST Stripe provider unavailable');
    await expect(modeClient({ connection: { mode: 'bogus' },
      services: { stripeForConnection: async () => ({}) } }))
      .rejects.toThrow('TEST Stripe provider unavailable');
    await expect(client({ connection: { mode: 'live' }, services: {} }))
      .rejects.toThrow(/LIVE account|Selected authenticated/);
  });
  it('LIVE resolution returns the verified selected-account client', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const db = createFakeDb({ accounts: [{ id: 'acct_FAKE', label: 'Fixture',
      live_enabled: true, live_connected: true }] });
    const stripe = { accounts: { retrieve: async () => ({ id: 'acct_FAKE', object: 'account' }) },
      balance: { retrieve: async () => ({ object: 'balance', livemode: true }) } };
    const ctx = { connection: { stripeAccount: 'acct_FAKE', mode: 'live', profile: 'full' },
      db, services: { stripeForConnection: async () => stripe } };
    await expect(modeClient(ctx)).resolves.toBe(stripe);
    await expect(client(ctx)).resolves.toBe(stripe);
  });
  it('LIVE resolution refuses a disabled account and a non-production deployment', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const stripe = { accounts: { retrieve: async () => ({ id: 'acct_FAKE', object: 'account' }) },
      balance: { retrieve: async () => ({ object: 'balance', livemode: true }) } };
    const disabledDb = createFakeDb({ accounts: [{ id: 'acct_FAKE', label: 'Fixture',
      live_enabled: false, live_connected: true }] });
    await expect(modeClient({ connection: { stripeAccount: 'acct_FAKE', mode: 'live', profile: 'full' },
      db: disabledDb, services: { stripeForConnection: async () => stripe } }))
      .rejects.toThrow(/disabled or disconnected/);
    const enabledDb = createFakeDb({ accounts: [{ id: 'acct_FAKE', label: 'Fixture',
      live_enabled: true, live_connected: true }] });
    vi.stubEnv('VERCEL_ENV', 'preview');
    await expect(modeClient({ connection: { stripeAccount: 'acct_FAKE', mode: 'live', profile: 'full' },
      db: enabledDb, services: { stripeForConnection: async () => stripe } }))
      .rejects.toThrow(/Independently activated LIVE account required/);
  });
  it('the seam alone does not open LIVE execution in payments or checkout: their wrapper refusals remain', async () => {
    const payment = makePaymentWrite('setup_cancel');
    const liveCtx = { connection: { stripeAccount: 'acct_FAKE', mode: 'live', profile: 'full' },
      db: createFakeDb(), services: { stripeForConnection: async () => ({}) } };
    expect(parse(await payment.handler({ setupId: 'seti_FAKE1234' }, liveCtx)).error)
      .toMatch(/TEST-only payment and refund operation/);
    const checkout = makeCheckoutWrite('paylink_deactivate');
    expect(parse(await checkout.handler({ linkId: 'plink_FAKE1234' }, liveCtx)).error)
      .toMatch(/TEST-only hosted operation/);
  });
  it('payment and checkout argument validation accepts previewFingerprint as a control field', async () => {
    const payment = makePaymentWrite('setup_cancel');
    const setup = { id: 'seti_FAKE1234', object: 'setup_intent', status: 'requires_action',
      customer: 'cus_FAKE1234', metadata: {} };
    let canceled = false;
    const stripe = { setupIntents: {
      retrieve: async () => ({ ...setup, status: canceled ? 'canceled' : 'requires_action' }),
      cancel: async () => { canceled = true; return { ...setup, status: 'canceled' }; } },
      customers: { retrieve: async () => ({ id: 'cus_FAKE1234', object: 'customer', metadata: {} }) } };
    const ctx = { connection: { stripeAccount: 'acct_FAKE', mode: 'test', profile: 'full' },
      connectionId: 'fixture-owner', db: createFakeDb(),
      services: { stripeForConnection: async () => stripe },
      getCustomer: id => stripe.customers.retrieve(id) };
    const preview = parse(await payment.handler({ setupId: 'seti_FAKE1234', dryRun: true }, ctx));
    expect(preview.done).toBe(false);
    expect(preview.previewFingerprint).toMatch(/^WRITE-(?:[0-9A-F]{5}-){3}[0-9A-F]{5}$/);
    const done = parse(await payment.handler({ setupId: 'seti_FAKE1234', confirm: true,
      requestKey: 'seam-fp', previewFingerprint: preview.previewFingerprint }, ctx));
    expect(done.done).toBe(true);
  });
});
