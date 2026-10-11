// V-1a disposable-local-PostgreSQL developer run and exact object ledger.
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
let db;
const account='acct_DEVFAKE',other='acct_OTHERFAKE';
const runId='run_'+'a'.repeat(24),requestKey='stable-seed-1',
  planDigest='b'.repeat(64);
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw new Error('Disposable localhost TEST database required');
  await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES ($1,$2),($3,$4)',
    [account,'Dev Fixture',other,'Another Fixture']);
});
afterAll(async()=>await closeIsolatedSchema());
describe('V-1a durable TEST seed run PostgreSQL',()=>{
  it('adds only two additive idempotent schema tables',async()=>{
    expect(SCHEMA_TABLES).toContain('dev_runs');
    expect(SCHEMA_TABLES).toContain('dev_run_objects');
    await db.initSchema();
    const tables=await rawQuery("SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name LIKE 'dev_%'");
    expect(tables.map(x=>x.table_name).sort()).toEqual(['dev_run_objects','dev_runs']);
  });
  it('idempotently claims only one matching run per account/request and rejects plan drift',async()=>{
    const a={id:runId,account,connection:'agent-demo',requestKey,
      scenario:'catalog-starter',size:1,planDigest};
    const one=await db.ensureDevRun(a);
    expect(one.status).toBe('running');
    const duplicate=await db.ensureDevRun(a);
    expect(duplicate.id).toBe(runId);
    const rows=await rawQuery('SELECT id FROM dev_runs WHERE stripe_account=$1',[account]);
    expect(rows).toHaveLength(1);
    await expect(db.ensureDevRun({...a,planDigest:'c'.repeat(64)}))
      .rejects.toThrow(/another immutable plan/);
  });
  it('records exactly the Stripe provider IDs, resists collisions and scopes by account',async()=>{
    expect(await db.getDevRunObjects({account,id:runId})).toEqual([]);
    const p={account,id:runId,stepName:'product_1',
      objectType:'product',objectId:'prod_FAKE1234'};
    expect(await db.recordDevRunObject(p)).toBe(true);
    expect(await db.recordDevRunObject(p)).toBe(true);
    expect(await db.recordDevRunObject({...p,objectId:'prod_WRONG1234'})).toBe(false);
    expect(await db.recordDevRunObject({...p,stepName:'price_1',
      objectType:'price',objectId:'price_FAKE1234'})).toBe(true);
    expect(await db.recordDevRunObject({...p,stepName:'customer_1',
      objectType:'customer',objectId:'cus_FAKE1234'})).toBe(true);
    expect((await db.getDevRunObjects({account,id:runId})).map(x=>x.step_name).sort())
      .toEqual(['customer_1','price_1','product_1']);
    expect(await db.getDevRunObjects({account:other,id:runId})).toEqual([]);
    expect(await db.completeDevRun({account:other,id:runId,expectedSteps:3})).toBe(false);
    expect(await db.completeDevRun({account,id:runId,expectedSteps:4})).toBe(false);
    expect(await db.completeDevRun({account,id:runId,expectedSteps:3})).toBe(true);
    expect((await db.getDevRun({account,requestKey})).status).toBe('completed');
  });
  it('lists safe account-scoped records and rejects invalid limits or cross-account read',async()=>{
    const rows=await db.listDevRuns({account});
    expect(rows).toHaveLength(1);
    expect(rows[0].object_count).toBe(3);
    expect(await db.listDevRuns({account:other})).toEqual([]);
    expect(await db.listDevRuns({account,offset:1})).toEqual([]);
    await expect(db.listDevRuns({account,limit:1000})).rejects.toThrow();
    expect(await db.getDevRun({account:other,requestKey})).toBeNull();
  });
});
