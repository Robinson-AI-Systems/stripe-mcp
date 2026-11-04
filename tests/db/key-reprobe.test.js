import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,neonShapedQuery,rawQuery} from
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
describe('CAP-4 D7b per-mode probe records',()=>{
  it('persists a LIVE probe against the LIVE key only, under the live gate',async()=>{
    const account='acct_PGPERMODE';
    await db.saveTestKey({account,label:'Fixture',ciphertext:'test-cipher',
      kind:'restricted',last4:'TEST',permissions:{customers:'denied'}});
    await db.saveLiveKey({account,ciphertext:'live-cipher',
      kind:'restricted',last4:'LIVE'});
    // LIVE persistence is gated on live_enabled, exactly like the
    // LIVE key read path: before enablement the update matches nothing.
    expect(await db.updateKeyPermissions({account,mode:'live',
      permissions:{payments:'ok'},expectedCiphertext:'live-cipher'})).toBe(false);
    await rawQuery('UPDATE stripe_accounts SET live_enabled=TRUE WHERE id=$1',
      [account]);
    expect(await db.updateKeyPermissions({account,mode:'live',
      permissions:{payments:'ok',customers:'denied'},
      expectedCiphertext:'live-cipher'})).toBe(true);
    const row=await db.getStripeAccount(account);
    expect(row.live_key_permissions).toEqual({payments:'ok',customers:'denied'});
    expect(row.live_key_checked_at).not.toBeNull();
    // The TEST record is untouched by the LIVE write.
    expect(row.key_permissions).toEqual({customers:'denied'});
    // Neither mode's update accepts the other mode's ciphertext.
    expect(await db.updateKeyPermissions({account,mode:'live',
      permissions:{payments:'denied'},expectedCiphertext:'test-cipher'})).toBe(false);
    expect(await db.updateKeyPermissions({account,mode:'test',
      permissions:{customers:'ok'},expectedCiphertext:'live-cipher'})).toBe(false);
    expect((await db.getStripeAccount(account)).live_key_permissions)
      .toEqual({payments:'ok',customers:'denied'});
    // A malformed mode is refused before any SQL runs.
    await expect(db.updateKeyPermissions({account,mode:'bogus',
      permissions:{payments:'ok'},expectedCiphertext:'live-cipher'}))
      .rejects.toThrow();
  });
  it('migrates a legacy-shaped table forward truthfully',async()=>{
    const account='acct_PGLEGACY';
    // Recreate the pre-D7b table shape: drop the LIVE probe columns,
    // then insert a row exactly as the baseline writers left it.
    await rawQuery('ALTER TABLE stripe_accounts DROP COLUMN IF EXISTS live_key_permissions');
    await rawQuery('ALTER TABLE stripe_accounts DROP COLUMN IF EXISTS live_key_checked_at');
    await rawQuery(`INSERT INTO stripe_accounts
      (id,label,test_key_enc,test_key_kind,test_key_last4,key_permissions,key_checked_at)
      VALUES ($1,'Legacy',$2,'restricted','FAKE',$3::jsonb,now())`,
      [account,'legacy-cipher',JSON.stringify({customers:'ok',invoices:'denied'})]);
    // The additive migration re-adds the LIVE record columns empty.
    await db.initSchema();
    const row=await db.getStripeAccount(account);
    // The pre-existing record reads as the TEST mode's record, with
    // its original values; the LIVE side starts never probed.
    expect(row.key_permissions).toEqual({customers:'ok',invoices:'denied'});
    expect(row.key_checked_at).not.toBeNull();
    expect(row.live_key_permissions).toBeNull();
    expect(row.live_key_checked_at).toBeNull();
    // And the migrated row accepts per-mode updates from here on.
    expect(await db.updateKeyPermissions({account,mode:'test',
      permissions:{customers:'denied'},expectedCiphertext:'legacy-cipher'}))
      .toBe(true);
    expect((await db.getStripeAccount(account)).key_permissions)
      .toEqual({customers:'denied'});
  });
});
