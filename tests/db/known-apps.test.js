import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {APP_SEED} from '../../src/apps/profiles.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
const account='acct_APPDB1',other='acct_APPDB2';
let db;
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw new Error('Disposable local PostgreSQL required');
  await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES ($1,$2),($3,$4)',
    [account,'Application DB test',other,'Unrelated account']);
});
afterAll(async()=>closeIsolatedSchema());
describe('P-1/P-2 profile migration, account isolation and owner scope',()=>{
  it('creates both tables and stable APP-NEEDS seed idempotently',async()=>{
    expect(SCHEMA_TABLES).toEqual(expect.arrayContaining([
      'known_apps','app_profile_account_scope']));
    await db.initSchema();
    const seed=await db.getKnownApp('appliance-desk');
    expect(seed).toMatchObject({id:'appliance-desk',version:1,status:'active'});
    expect(seed.profile.metadata_keys).toEqual([...APP_SEED.metadata_keys]);
    expect(seed.profile.webhook_events).toEqual([...APP_SEED.webhook_events]);
    expect(seed.profile.stripe_accounts).toEqual([]);
    expect(await db.listKnownAppsForAccount(account)).toEqual([]);
    expect(await db.getAppGuardScope(account)).toBe('legacy');
  });
  it('binds one real selected account with CAS, does not affect another',async()=>{
    const first=await db.bindKnownAppAccount({id:'appliance-desk',
      account,expectedVersion:1,attach:true});
    expect(first.version).toBe(2);
    expect(first.profile.stripe_accounts).toEqual([account]);
    expect((await db.listKnownAppsForAccount(account)).map(x=>x.id))
      .toEqual(['appliance-desk']);
    expect(await db.listKnownAppsForAccount(other)).toEqual([]);
    await expect(db.bindKnownAppAccount({id:'appliance-desk',
      account:other,expectedVersion:1,attach:true}))
      .rejects.toThrow(/revision changed/);
    expect((await db.getKnownApp('appliance-desk')).version).toBe(2);
  });
  it('proves no implicit legacy-to-scoped migration or orphan assignment',async()=>{
    const second=await db.bindKnownAppAccount({id:'appliance-desk',account:other,
      expectedVersion:2,attach:true});
    expect(second.profile.stripe_accounts).toEqual([account,other]);
    await expect(db.bindKnownAppAccount({id:'appliance-desk',
      account:'acct_MISSING',expectedVersion:3,attach:true}))
      .rejects.toThrow(/account missing/);
    expect(await db.getAppGuardScope(account)).toBe('legacy');
    expect(await db.enableScopedAppGuard({account,expectedScope:'legacy'}))
      .toBe('scoped');
    expect(await db.getAppGuardScope(account)).toBe('scoped');
    expect(await db.getAppGuardScope(other)).toBe('legacy');
    const again=await db.enableScopedAppGuard({account,expectedScope:'legacy'});
    expect(again).toBe('scoped');
    const row=await rawQuery('SELECT scope FROM app_profile_account_scope WHERE stripe_account=$1',
      [account]);
    expect(row).toEqual([{scope:'scoped'}]);
  });
  it('enforces expected revisions, disabled status and explicit detachment',async()=>{
    const three=await db.bindKnownAppAccount({id:'appliance-desk',account,
      expectedVersion:3,attach:false});
    expect(three.profile.stripe_accounts).toEqual([other]);
    expect((await db.listKnownAppsForAccount(account))).toEqual([]);
    expect(await db.listKnownAppsForAccount(other)).toHaveLength(1);
    await expect(db.bindKnownAppAccount({id:'appliance-desk',account,
      expectedVersion:1,attach:true})).rejects.toThrow();
  });
});
