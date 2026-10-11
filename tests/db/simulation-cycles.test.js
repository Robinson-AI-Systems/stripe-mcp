import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
const account='acct_TESTCYCLES',other='acct_OTHERTEST';
const id='run_'+'f'.repeat(24),key='cycle-one';
const base={accountId:account,runId:id,cycle:1,
  requestKey:key,targetFrozenTime:1761000000};
let db;
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw new Error('Disposable localhost Postgres required');
  await openIsolatedSchema(dsn);db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES ($1,$2),($3,$4)',
    [account,'sim',other,'other']);
  await db.ensureDevRun({id,account,connection:null,requestKey:'setup-one',
    scenario:'subscription-simulation',size:3,planDigest:'a'.repeat(64)});
  await db.recordDevRunObject({account,id,stepName:'clock_1',
    objectType:'test_clock',objectId:'clock_MOCK999'});
  await db.completeDevRun({account,id,expectedSteps:1});
});
afterAll(async()=>closeIsolatedSchema());
describe('V-5c1 atomic monthly TEST simulation ledger',()=>{
  it('declares only additive account-scoped storage with no event or secret blobs',async()=>{
    expect(SCHEMA_TABLES).toContain('dev_simulation_cycles');
    await db.initSchema();
    const cols=await rawQuery(`SELECT column_name FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name='dev_simulation_cycles'`);
    const keys=cols.map(x=>x.column_name);
    expect(keys).toContain('target_frozen_time');
    expect(keys).not.toContain('secret_enc');
    expect(keys).not.toContain('event_payload');
    expect(keys).toContain('event_id');
    expect(keys).toContain('event_type');
  });
  it('reserves once with a stable immutable retry key for the selected account',async()=>{
    expect(await db.getDevSimulationCycles({accountId:other,runId:id})).toEqual([]);
    expect(await db.reserveDevSimulationCycle(base)).toEqual({
      cycle:1,newlyReserved:true});
    expect(await db.reserveDevSimulationCycle(base)).toEqual({
      cycle:1,newlyReserved:false});
    await expect(db.reserveDevSimulationCycle({...base,requestKey:'different'}))
      .rejects.toThrow(/immutable target/);
    await expect(db.reserveDevSimulationCycle({...base,accountId:other,
      requestKey:'foreign'})).rejects.toThrow(/Cycle unavailable/);
  });
  it('blocks month 2 while month 1 is not observed; fail closed before sending',async()=>{
    await expect(db.reserveDevSimulationCycle({...base,cycle:2,
      requestKey:'cycle-two',targetFrozenTime:1763600000}))
      .rejects.toThrow(/not sequential/);
    expect(await db.beginDevSimulationCycle({...base,accountId:other}))
      .toBe(false);
    expect(await db.beginDevSimulationCycle(base)).toBe(true);
    expect(await db.beginDevSimulationCycle(base)).toBe(false);
    const row=(await db.getDevSimulationCycles({
      accountId:account,runId:id}))[0];
    expect(row).toMatchObject({cycle:1,state:'uncertain',
      invoiceId:null,observedAt:null});
  });
  it('never infers success from clock alone; requires matching invoice and payment',async()=>{
    const good={...base,observedClockTime:base.targetFrozenTime,
      invoiceId:'in_TEST001',invoiceStatus:'paid',
      paymentIntentId:'pi_TEST001',paymentStatus:'succeeded',eventId:'evt_TEST001',eventType:'invoice.payment_succeeded'};
    for(const change of [
      {observedClockTime:base.targetFrozenTime+1},
      {invoiceId:'in_FAKE!'},
      {invoiceStatus:'paid',paymentStatus:'processing'},
      {invoiceStatus:'deleted'},
      {paymentStatus:'unknown'}
    ])await expect(db.observeDevSimulationCycle({...good,...change}))
      .rejects.toThrow();
    expect(await db.observeDevSimulationCycle({...good,
      accountId:other})).toBe(false);
    expect(await db.observeDevSimulationCycle(good)).toBe(true);
    expect(await db.observeDevSimulationCycle(good)).toBe(false);
    expect((await db.getDevSimulationCycles({accountId:account,runId:id}))[0])
      .toMatchObject({state:'observed',invoiceId:'in_TEST001',
        invoiceStatus:'paid',paymentStatus:'succeeded',eventId:'evt_TEST001'});
  });
  it('unlocks exactly one subsequent month and keeps its own uncertain state',async()=>{
    const second={...base,cycle:2,requestKey:'cycle-two',
      targetFrozenTime:1763600000};
    expect(await db.reserveDevSimulationCycle(second))
      .toEqual({cycle:2,newlyReserved:true});
    expect(await db.beginDevSimulationCycle(second)).toBe(true);
    await expect(db.reserveDevSimulationCycle({...base,cycle:3,
      requestKey:'cycle-three',targetFrozenTime:1766200000}))
      .rejects.toThrow(/not sequential/);
    const rows=await db.getDevSimulationCycles({accountId:account,runId:id});
    expect(rows.map(x=>x.state)).toEqual(['observed','uncertain']);
  });
});
