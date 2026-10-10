// Stripe-specific encrypted key store. No tool or MCP API accepts a Stripe key argument.
import { makeStripeClient } from './stripe/client.js';
import { encryptSecret, decryptSecret, readEncryptionKey } from './core/crypto.js';

// Harmless read probes only. Permission-denied means unavailable; network/provider errors abort setup.
export async function probeKeyPermissions(stripe) {
  const probes = {
    customers: () => stripe.customers.list({ limit: 1 }),
    payments: () => stripe.paymentIntents.list({ limit: 1 }),
    subscriptions: () => stripe.subscriptions.list({ limit: 1 }),
    invoices: () => stripe.invoices.list({ limit: 1 }),
    products: () => stripe.products.list({ limit: 1 }),
    prices: () => stripe.prices.list({ limit: 1 }),
    refunds: () => stripe.refunds.list({ limit: 1 }),
    disputes: () => stripe.disputes.list({ limit: 1 }),
    webhooks: () => stripe.webhookEndpoints.list({ limit: 1 })
  };
  const result = {};
  for (const [name, fn] of Object.entries(probes)) {
    try { await fn(); result[name] = 'ok'; }
    catch (error) {
      if (error?.statusCode === 403 || error?.code === 'permission_denied') result[name] = 'denied';
      else throw new Error('Stripe permission probe was unavailable. Try again later.');
    }
  }
  return result;
}

export function createKeyStore({ db, makeClient = makeStripeClient,
  probe = probeKeyPermissions, encryptionKey = readEncryptionKey() }) {
  if (!db || typeof db.saveTestKey !== 'function') throw new TypeError('Key database is required');
  return {
    async storeTestKey({ key, label }) {
      // Test-only until Batch B's explicit owner-controlled live activation is implemented.
      if (typeof key !== 'string' || !/^(?:sk|rk)_test_[A-Za-z0-9]+$/.test(key)) {
        throw new Error('Only a Stripe test-mode secret or restricted key can be added');
      }
      const stripe = makeClient({ key, mode: 'test' });
      let stripeAccount;
      try { stripeAccount = await stripe.accounts.retrieve(); }
      catch { throw new Error('Stripe rejected the test key or account details could not be read'); }
      const account = stripeAccount?.id;
      if (typeof account !== 'string' || !/^acct_[A-Za-z0-9]+$/.test(account)) {
        throw new Error('Unable to verify the account for this key');
      }
      const safeLabel = String(label || stripeAccount.business_profile?.name || account).slice(0,100);
      const ciphertext = encryptSecret(key, { aad: 'stripe-account/' + account + '/test', key: encryptionKey });
      const kind = key.startsWith('rk_') ? 'restricted' : 'secret';
      const last4 = key.slice(-4);
      const permissions = await probe(stripe);
      await db.saveTestKey({ account, label: safeLabel, ciphertext, kind, last4, permissions });
      return { account, label: safeLabel, mode: 'test', kind, last4 };
    },
    async loadKey({ account, mode = 'test' }) {
      if (mode !== 'test') throw new Error('Live Stripe access is not enabled');
      const record = await db.getEncryptedKey({ account, mode });
      if (!record?.ciphertext) throw new Error('No test key is configured for this Stripe account');
      return decryptSecret(record.ciphertext,
        { aad: 'stripe-account/' + account + '/test', key: encryptionKey });
    }
  };
}

export function createPermissionReprobe({db, keyStoreFactory=createKeyStore,
  makeClient=makeStripeClient, probe=probeKeyPermissions}) {
  return async ({account,mode}) => {
    if (typeof account!=='string' || !/^acct_[A-Za-z0-9]+$/.test(account) ||
        mode!=='test' || typeof db?.updateKeyPermissions!=='function') {
      throw new Error('A configured TEST account is required for permission checks');
    }
    // Server-only lazy credential decryption. Nothing is returned to the AI.
    const keyStore=keyStoreFactory({db});
    const key=await keyStore.loadKey({account,mode:'test'});
    const permissions=await probe(makeClient({key,mode:'test'}));
    if (!permissions || typeof permissions!=='object' || Array.isArray(permissions)) {
      throw new Error('Stripe permission probes did not return a verified result');
    }
    if (!await db.updateKeyPermissions({account,permissions})) {
      throw new Error('The selected TEST key could not be updated');
    }
    return {account,mode:'test',permissions,checkedAt:new Date().toISOString()};
  };
}
