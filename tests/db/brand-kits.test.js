import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
const acct='acct_BRANDPG',other='acct_OTHERPG';
let db;
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw new Error('Disposable local PostgreSQL is required');
  await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES ($1,$2),($3,$4)',
    [acct,'Brand fixture',other,'Other fixture']);
});
afterAll(async()=>closeIsolatedSchema());
describe('H-1 TEST brand kit PostgreSQL persistence',()=>{
  it('has an additive keyed table and idempotent schema setup',async()=>{
    expect(SCHEMA_TABLES).toContain('brand_kits');
    await db.initSchema();
    const r=await rawQuery("SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='brand_kits'");
    expect(r).toHaveLength(1);
  });
  it('uses exact account/mode, optimistic revisions, duplicate no-op and real JSONB readback',async()=>{
    expect(await db.getBrandKit({account:acct,mode:'test'})).toBeNull();
    const one=await db.saveBrandKit({account:acct,mode:'test',
      settings:{backgroundColor:'#112233'},expectedVersion:0});
    expect(one.version).toBe(1);
    const same=await db.saveBrandKit({account:acct,mode:'test',
      settings:{backgroundColor:'#112233'},expectedVersion:0});
    expect(same.version).toBe(1);
    await expect(db.saveBrandKit({account:acct,mode:'test',
      settings:{backgroundColor:'#445566'},expectedVersion:0}))
      .rejects.toThrow(/revision changed/);
    expect((await db.getBrandKit({account:acct,mode:'test'})).settings)
      .toMatchObject({backgroundColor:'#112233'});
    expect(await db.getBrandKit({account:other,mode:'test'})).toBeNull();
    const two=await db.saveBrandKit({account:acct,mode:'test',
      settings:{displayName:'New brand'},expectedVersion:1});
    expect(two.version).toBe(2);
    await expect(db.saveBrandKit({account:other,mode:'live',
      settings:{displayName:'No LIVE'},expectedVersion:0})).rejects.toThrow();
  });
  it('does not accept an account or mode mismatch or create orphaned branding',async()=>{
    await expect(db.saveBrandKit({account:'acct_MISSING',mode:'test',
      settings:{displayName:'Orphan'},expectedVersion:0})).rejects.toThrow();
    await expect(db.getBrandKit({account:acct,mode:'unknown'})).rejects.toThrow();
    const rows=await rawQuery('SELECT stripe_account,mode,version FROM brand_kits');
    expect(rows).toEqual([{stripe_account:acct,mode:'test',version:2}]);
  });
});
