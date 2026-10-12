import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { createDb } from '../../src/db.js';
import { createKeyStore } from '../../src/keys.js';
import { createOneTimeStore } from '../../src/core/one-time-secrets.js';
import { makeFakeStripe } from '../../test/helpers/fake-stripe.js';
import { openIsolatedSchema, closeIsolatedSchema, neonShapedQuery, rawQuery } from '../../test/helpers/pg-neon-adapter.js';

let db;
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL ||
    !['localhost','127.0.0.1','::1'].includes(new URL(process.env.TEST_DATABASE_URL).hostname)) {
    throw new Error('A-5a tests require disposable localhost PostgreSQL');
  }
  await openIsolatedSchema(process.env.TEST_DATABASE_URL);
  db = createDb(neonShapedQuery());
  await db.initSchema();
});
afterAll(async () => { await closeIsolatedSchema(); });

describe('encrypted Stripe credentials on isolated real PostgreSQL', () => {
  it('stores only AES-GCM ciphertext and permits server-only decrypt', async () => {
    const key = randomBytes(32), fake = makeFakeStripe(), apiKey = ['rk','test','FAKEFAKEFAKEFAKEFAKE'].join('_');
    fake.when('accounts.retrieve').resolves({object:'account',id:'acct_FAKESTORE',
      livemode:false,business_profile:{name:'Fixture'} });
    const vault = createKeyStore({ db, encryptionKey:key, makeClient:()=>fake.stripe, probe:async()=>({}) });
    const metadata = await vault.storeTestKey({ key:apiKey });
    expect(metadata).toMatchObject({ account:'acct_FAKESTORE', mode:'test', kind:'restricted' });
    const [row] = await rawQuery('SELECT test_key_enc, test_key_kind, test_key_last4, live_key_enc, live_enabled FROM stripe_accounts WHERE id = $1', ['acct_FAKESTORE']);
    expect(row.test_key_enc).toMatch(/^v1\./);
    expect(row.test_key_enc).not.toContain(apiKey);
    expect(row.test_key_kind).toBe('restricted');
    expect(row.test_key_last4).toBe(apiKey.slice(-4));
    expect(row.live_key_enc).toBeNull();
    expect(row.live_enabled).toBe(false);
    expect(await vault.loadKey({ account:'acct_FAKESTORE' })).toBe(apiKey);
    const wrong = createKeyStore({ db, encryptionKey:randomBytes(32), makeClient:()=>fake.stripe });
    await expect(wrong.loadKey({ account:'acct_FAKESTORE' })).rejects.toThrow(/Unable to decrypt/);
  });
  it('atomically deletes one-time secret on first reveal, including under concurrency', async () => {
    const secret = 'fixture-signature-only', vault = createOneTimeStore({ db, encryptionKey:randomBytes(32) });
    const link = await vault.issue({ account:'acct_FAKESTORE', mode:'test', kind:'webhook-secret', secret });
    const answers = await Promise.all([vault.consume(link.id),vault.consume(link.id)]);
    expect(answers.filter(Boolean)).toEqual([secret]);
    expect(await vault.consume(link.id)).toBeNull();
    const rows = await rawQuery('SELECT id FROM one_time_secrets WHERE id = $1', [link.id]);
    expect(rows).toHaveLength(0);
  });
});
