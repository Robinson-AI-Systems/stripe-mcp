// Stripe-specific encrypted key store. No tool or MCP API accepts a Stripe key argument.
import { makeStripeClient } from './stripe/client.js';
import { encryptSecret, decryptSecret, readEncryptionKey } from './core/crypto.js';

export function createKeyStore({ db, makeClient = makeStripeClient, encryptionKey = readEncryptionKey() }) {
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
      await db.saveTestKey({ account, label: safeLabel, ciphertext, kind, last4 });
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
