import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
const a='acct_TESTSIGNATUREA',b='acct_TESTSIGNATUREB',endpoint='we_TESTSIGNATURE';
let db;
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost Postgres required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES($1,$2),($3,$4)',
    [a,'first',b,'second']);
});
afterAll(async()=>closeIsolatedSchema());
describe('Encrypted TEST webhook signing secret persistence',()=>{
  it('stores ciphertext only, scopes by account and rotates without changing the peer',async()=>{
    expect(SCHEMA_TABLES).toContain('webhook_signing_secrets');
    const envelope='v1.nonsecretfixture';
    expect(await db.saveWebhookSigningSecret({account:a,endpoint,ciphertext:envelope})).toBe(true);
    expect(await db.getWebhookSigningSecret({account:a,endpoint})).toEqual({ciphertext:envelope});
    expect(await db.getWebhookSigningSecret({account:b,endpoint})).toBeNull();
    expect(await db.saveWebhookSigningSecret({account:a,endpoint,ciphertext:'v1.newcipher'})).toBe(true);
    expect((await db.getWebhookSigningSecret({account:a,endpoint})).ciphertext).toBe('v1.newcipher');
    expect(await db.deleteWebhookSigningSecret({account:b,endpoint})).toBe(false);
    expect(await db.deleteWebhookSigningSecret({account:a,endpoint})).toBe(true);
    expect(await db.getWebhookSigningSecret({account:a,endpoint})).toBeNull();
    expect(await db.deleteWebhookSigningSecret({account:a,endpoint})).toBe(false);
  });
});
