// Stripe-specific encrypted key store. No tool or MCP API accepts a Stripe key argument.
import { makeStripeClient } from './stripe/client.js';
import { readVerifiedTestAccount,readVerifiedLiveAccount } from './stripe/test-account.js';
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
      try { stripeAccount = await readVerifiedTestAccount(stripe); }
      catch { throw new Error('Unable to verify explicit TEST identity for this key'); }
      const account = stripeAccount.id;
      const safeLabel = String(label || stripeAccount.business_profile?.name || account).slice(0,100);
      const ciphertext = encryptSecret(key, { aad: 'stripe-account/' + account + '/test', key: encryptionKey });
      const kind = key.startsWith('rk_') ? 'restricted' : 'secret';
      const last4 = key.slice(-4);
      const permissions = await probe(stripe);
      await db.saveTestKey({ account, label: safeLabel, ciphertext, kind, last4, permissions });
      return { account, label: safeLabel, mode: 'test', kind, last4 };
    },
    async storeLiveKey({key,account}) {
      // This method is reached only from the protected owner browser after
      // explicit LIVE consent. It stores a credential; it never activates LIVE.
      if(typeof key!=='string'||!/^(?:sk|rk)_live_[A-Za-z0-9]+$/.test(key)||
        typeof account!=='string'||!/^acct_[A-Za-z0-9]{2,100}$/.test(account)||
        typeof db.saveLiveKey!=='function')
        throw new TypeError('Explicit existing Stripe account and LIVE key required');
      const stripe=makeClient({key,mode:'live'});
      try{await readVerifiedLiveAccount(stripe,account);}
      catch{throw new Error('Unable to verify exact LIVE Stripe account and mode');}
      const ciphertext=encryptSecret(key,{aad:'stripe-account/'+account+'/live',key:encryptionKey});
      const saved=await db.saveLiveKey({account,ciphertext,
        kind:key.startsWith('rk_')?'restricted':'secret',last4:key.slice(-4)});
      if(!saved)throw new Error('Enroll a matching TEST account before adding its LIVE credential');
      return {account,mode:'live',kind:key.startsWith('rk_')?'restricted':'secret',last4:key.slice(-4),activated:false};
    },
    async loadKeySnapshot({ account, mode = 'test' }) {
      if(!['test','live'].includes(mode)||
        (mode==='live'&&process.env.VERCEL_ENV!=='production'))
        throw new Error('Live Stripe access is not enabled outside an activated production deployment');
      const record=await db.getEncryptedKey({account,mode});
      if(!record?.ciphertext)throw new Error(mode==='test'? 'No test key is configured for this Stripe account': 'No authorized LIVE key for this account');
      return {
        key:decryptSecret(record.ciphertext,
          { aad:'stripe-account/'+account+'/'+mode,key:encryptionKey }),
        expectedCiphertext:record.ciphertext
      };
    },
    async loadKey(options) {
      return (await this.loadKeySnapshot(options)).key;
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
    const snapshot=await keyStore.loadKeySnapshot({account,mode:'test'});
    if (typeof snapshot?.key!=='string' || typeof snapshot.expectedCiphertext!=='string' ||
        !snapshot.expectedCiphertext) {
      throw new Error('TEST key snapshot unavailable: permission update refused');
    }
    const stripe=makeClient({key:snapshot.key,mode:'test'});
    try{await readVerifiedTestAccount(stripe,account);}
    catch{throw new Error('Selected TEST account identity could not be verified');}
    // Never update permission metadata without exact provider account identity
    // and explicit TEST evidence, including for Accounts without livemode.
    const permissions=await probe(stripe);
    if (!permissions || typeof permissions!=='object' || Array.isArray(permissions)) {
      throw new Error('Stripe permission probes did not return a verified result');
    }
    if (!await db.updateKeyPermissions({
      account,permissions,expectedCiphertext:snapshot.expectedCiphertext
    })) {
      throw new Error('The selected TEST key could not be updated');
    }
    return {account,mode:'test',permissions,checkedAt:new Date().toISOString()};
  };
}
