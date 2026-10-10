import {describe,expect,it,beforeAll,afterAll} from 'vitest';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
 from '../../test/helpers/pg-neon-adapter.js';
let db;
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url || !['localhost','127.0.0.1','::1'].includes(new URL(url).hostname)) {
    throw new Error('Disposable localhost PostgreSQL required');
  }
  await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts (id,label) VALUES ($1,$2),($3,$4)',
    ['acct_pg_A','Fixture A','acct_pg_B','Fixture B']);
});
afterAll(async()=>{await closeIsolatedSchema();});
describe('B-8a database read tools are scoped and exclude secrets',()=>{
  it('keeps history summaries scoped to the selected account/mode',async()=>{
    await db.recordChange({account:'acct_pg_A',mode:'test',tool:'test_a',summary:'Fake A'});
    await db.recordChange({account:'acct_pg_B',mode:'test',tool:'test_b',summary:'Fake B'});
    await db.recordChange({account:'acct_pg_A',mode:'live',tool:'test_live_a',summary:'Fake LIVE A'});
    const selected=await db.listRecentChanges({account:'acct_pg_A',mode:'test',limit:5});
    expect(selected.map(x=>x.tool)).toEqual(['test_a']);
    expect(JSON.stringify(selected)).not.toContain('test_b');
    expect(JSON.stringify(selected)).not.toContain('before');
    expect(JSON.stringify(selected)).not.toContain('inverse');
  });
  it('lists only public connection metadata, not bearer tokens',async()=>{
    const token='a'.repeat(48);
    await db.createAccessToken({accessToken:token,clientId:'cli_a',
      stripeAccount:'acct_pg_A',profile:'everyday',mode:'test'});
    await db.createAccessToken({accessToken:'b'.repeat(48),clientId:'cli_b',
      stripeAccount:'acct_pg_B',profile:'full',mode:'test'});
    const rows=await db.listConnectionsForAccount({account:'acct_pg_A',limit:10});
    expect(rows).toHaveLength(1);
    expect(rows[0].client_id).toBe('cli_a');
    expect(JSON.stringify(rows)).not.toContain('cli_b');
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(JSON.stringify(rows)).not.toContain('token_hash');
  });
});
