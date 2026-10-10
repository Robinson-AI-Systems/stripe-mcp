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
    await db.saveTestKey({account:'acct_PG_PERMISSION',label:'Fixture',ciphertext:'fake-encrypted',
      kind:'restricted',last4:'FAKE',permissions:{customers:'denied'}});
    expect(await db.updateKeyPermissions({account:'acct_PG_PERMISSION',
      permissions:{customers:'ok',refunds:'denied'}})).toBe(true);
    const row=await db.getStripeAccount('acct_PG_PERMISSION');
    expect(row.key_permissions).toEqual({customers:'ok',refunds:'denied'});
    expect(await db.updateKeyPermissions({account:'acct_UNKNOWN',
      permissions:{customers:'ok'}})).toBe(false);
    await expect(db.updateKeyPermissions({account:'acct_PG_PERMISSION',
      permissions:{refunds:'maybe'}})).rejects.toThrow();
  });
});
