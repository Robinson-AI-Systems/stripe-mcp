// V-1a disposable-local-PostgreSQL developer run and exact object ledger.
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {planTrigger} from '../../src/dev/triggers.js';
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
    expect(tables.map(x=>x.table_name).sort())
      .toEqual(['dev_forwarder_replay_events','dev_forwarder_replays',
        'dev_forwarders','dev_run_objects','dev_runs','dev_simulation_cycles']);
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
  it('accepts only correctly typed payment and subscription IDs from tracked TEST runs',async()=>{
    const run='run_'+'c'.repeat(24),key='extended-seed-run';
    await db.ensureDevRun({id:run,account,connection:'agent-dev',
      requestKey:key,scenario:'basic-store',size:1,planDigest:'d'.repeat(64)});
    expect(await db.recordDevRunObject({account,id:run,stepName:'payment_1',
      objectType:'payment_intent',objectId:'pi_FAKE1234'})).toBe(true);
    expect(await db.recordDevRunObject({account,id:run,stepName:'subscription_1',
      objectType:'subscription',objectId:'sub_FAKE1234'})).toBe(true);
    await expect(db.recordDevRunObject({account,id:run,stepName:'wrong',
      objectType:'payment_intent',objectId:'prod_FAKE1234'}))
      .rejects.toThrow(/Verified provider-created/);
    expect(await db.getDevRunObjects({account:other,id:run})).toEqual([]);
    expect((await db.getDevRunObjects({account,id:run})).length).toBe(2);
  });

  it('records one independently verified refunded store payment on a completed account-scoped run',async()=>{
    const run='run_'+'c'.repeat(24);
    expect(await db.completeDevRun({account,id:run,expectedSteps:2})).toBe(true);
    expect(await db.recordDevRunRefund({account,id:run,
      paymentStep:'payment_1',refundId:'re_FAKE1234'})).toBe(true);
    expect(await db.recordDevRunRefund({account,id:run,
      paymentStep:'payment_1',refundId:'re_FAKE1234'})).toBe(true);
    expect(await db.recordDevRunRefund({account,id:run,
      paymentStep:'payment_1',refundId:'re_DIFFERENT'})).toBe(false);
    expect(await db.recordDevRunRefund({account:other,id:run,
      paymentStep:'payment_1',refundId:'re_BAD1234'})).toBe(false);
    const objects=await db.getDevRunObjects({account,id:run});
    expect(objects.filter(x=>x.object_type==='refund').map(x=>x.object_id))
      .toEqual(['re_FAKE1234']);
    expect(await db.getDevRunById({account:other,id:run})).toBeNull();
  });

});

describe('V-2a account-scoped provider cleanup ledger marking',()=>{
  it('marks only the exact recorded object ID under its owning account',async()=>{
    const id='run_'+'e'.repeat(24);
    await db.ensureDevRun({id,account,connection:'cleanup-fixture',
      requestKey:'cleanup-exact',scenario:'catalog-starter',size:1,
      planDigest:'e'.repeat(64)});
    expect(await db.recordDevRunObject({account,id,stepName:'product_1',
      objectType:'product',objectId:'prod_CLEANUP1'})).toBe(true);
    const args={account,id,stepName:'product_1',objectType:'product',
      objectId:'prod_CLEANUP1'};
    expect(await db.markDevRunObjectCleaned({...args,account:other}))
      .toBe(false);
    expect(await db.markDevRunObjectCleaned({...args,
      objectId:'prod_WRONG123'})).toBe(false);
    expect((await db.getDevRunObjects({account,id}))[0].cleaned).toBe(false);
    expect(await db.markDevRunObjectCleaned(args)).toBe(true);
    expect(await db.markDevRunObjectCleaned(args)).toBe(true);
    expect((await db.getDevRunObjects({account,id}))[0].cleaned).toBe(true);
  });
});

describe('V-3 recovery — atomic original verified Stripe Event evidence',()=>{
  it('accepts only matching immutable account+plan with fully recorded source, one of two concurrent inserts',async()=>{
    const plan=planTrigger({type:'customer.created',
      requestKey:'reconcile-duplicate-atomic'},account);
    const p={id:plan.runId,account,connection:'fixture',
      requestKey:'reconcile-duplicate-atomic',scenario:plan.scenario,
      size:1,planDigest:plan.planDigest};
    await db.ensureDevRun(p);
    const e={account,id:plan.runId,scenario:plan.scenario,
      planDigest:plan.planDigest,expectedSteps:plan.expectedSteps,
      eventId:'evt_VERIFIEDATOM123'};
    expect(await db.reconcileVerifiedTriggerEvent(e)).toBe(false);
    expect(await db.getDevRunObjects({account,id:plan.runId})).toEqual([]);
    expect(await db.recordDevRunObject({account,id:plan.runId,
      stepName:'customer_1',objectType:'customer',
      objectId:'cus_VERIFIEDATOM123'})).toBe(true);
    expect(await db.markDevRunObjectCleaned({account,id:plan.runId,
      stepName:'customer_1',objectType:'customer',
      objectId:'cus_VERIFIEDATOM123'})).toBe(true);
    expect(await db.reconcileVerifiedTriggerEvent({...e,account:other})).toBe(false);
    expect(await db.reconcileVerifiedTriggerEvent({...e,
      planDigest:'f'.repeat(64)})).toBe(false);
    expect(await db.reconcileVerifiedTriggerEvent({...e,
      scenario:'event-customer-updated'})).toBe(false);
    expect(await db.reconcileVerifiedTriggerEvent({...e,
      expectedSteps:3})).toBe(false);
    const [one,two]=await Promise.all([
      db.reconcileVerifiedTriggerEvent(e),db.reconcileVerifiedTriggerEvent(e)]);
    expect([one,two].sort()).toEqual([false,true]);
    const run=await db.getDevRunById({account,id:plan.runId});
    expect(run.status).toBe('completed');
    const objs=await db.getDevRunObjects({account,id:plan.runId});
    expect(objs).toHaveLength(2);
    expect(objs.find(x=>x.step_name==='event_1')).toMatchObject({
      object_type:'event',object_id:e.eventId,cleaned:false});
    expect(objs.find(x=>x.step_name==='customer_1').cleaned).toBe(true);
    expect(await db.reconcileVerifiedTriggerEvent(e)).toBe(false);
    const receipts=await rawQuery(
      "SELECT count(*)::integer AS n FROM dev_run_objects WHERE run_id=$1 AND step_name='event_1'",
      [plan.runId]);
    expect(receipts[0].n).toBe(1);
  });
  it('fails closed for forged, malformed, or incomplete original evidence',async()=>{
    const plan=planTrigger({type:'customer.updated',
      requestKey:'reconcile-missing-source'},account);
    const p={id:plan.runId,account,connection:null,
      requestKey:'reconcile-missing-source',scenario:plan.scenario,
      size:1,planDigest:plan.planDigest};
    await db.ensureDevRun(p);
    const evidence={account,id:plan.runId,scenario:plan.scenario,
      planDigest:plan.planDigest,expectedSteps:plan.expectedSteps,
      eventId:'evt_NOFAKE123'};
    expect(await db.reconcileVerifiedTriggerEvent(evidence)).toBe(false);
    await expect(db.reconcileVerifiedTriggerEvent({...evidence,eventId:'not-an-event'}))
      .rejects.toThrow(/Valid immutable/);
    const r=await db.getDevRunById({account,id:plan.runId});
    expect(r.status).toBe('running');
    expect(await db.getDevRunObjects({account,id:plan.runId})).toEqual([]);
  });
});
