import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,neonShapedQuery} from
  '../../test/helpers/pg-neon-adapter.js';
let db;
beforeAll(async()=>{
 const url=process.env.TEST_DATABASE_URL;
 if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname)) {
   throw Error('Disposable localhost PostgreSQL only');
 }
 await openIsolatedSchema(url);
 db=createDb(neonShapedQuery());
 await db.initSchema();
});
afterAll(async()=>{await closeIsolatedSchema();});
describe('B-8b1 durable permissions read-back',()=>{
  it('updates the selected encrypted TEST key record and nothing else',async()=>{
    await db.saveTestKey({account:'acct_PGPERMISSION',label:'Fixture',ciphertext:'fake-encrypted',
      kind:'restricted',last4:'FAKE',permissions:{customers:'denied'}});
    expect(await db.updateKeyPermissions({account:'acct_PGPERMISSION',
      permissions:{customers:'ok',refunds:'denied'},expectedCiphertext:'fake-encrypted'})).toBe(true);
    const row=await db.getStripeAccount('acct_PGPERMISSION');
    expect(row.key_permissions).toEqual({customers:'ok',refunds:'denied'});
    await db.saveTestKey({account:'acct_PGPERMISSION',label:'Rotated',ciphertext:'new-cipher',
      kind:'restricted',last4:'NEW4',permissions:{customers:'denied'}});
    expect(await db.updateKeyPermissions({account:'acct_PGPERMISSION',
      permissions:{customers:'ok'},expectedCiphertext:'fake-encrypted'})).toBe(false);
    expect((await db.getStripeAccount('acct_PGPERMISSION')).key_permissions)
      .toEqual({customers:'denied'});
    expect(await db.updateKeyPermissions({account:'acct_UNKNOWN',
      permissions:{customers:'ok'},expectedCiphertext:'fake-encrypted'})).toBe(false);
    await expect(db.updateKeyPermissions({account:'acct_PGPERMISSION',
      permissions:{refunds:'maybe'},expectedCiphertext:'fake-encrypted'})).rejects.toThrow();
  });
});
