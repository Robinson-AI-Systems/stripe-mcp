import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';

let db;
const account='acct_METERE3A',other='acct_METERE3B';
const base={account,meterId:'mtr_E3A',customerId:'cus_E3A',
  eventName:'requests_total',identifier:'unique-usage-event-001',
  units:5,requestKey:'rmcp_e3_claim_001',mode:'test'};
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw new Error('Disposable localhost PostgreSQL required');
  await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  for(const id of [account,other])
    await db.saveTestKey({account:id,label:'E-3 isolated',ciphertext:'fake-'+id,
      kind:'restricted',last4:'FAKE'});
});
afterAll(async()=>closeIsolatedSchema());
describe('E-3 original money and usage database invariants',()=>{
  it('adds durable claims without weakening existing schema or token/secret policy',async()=>{
    expect(SCHEMA_TABLES).toContain('meter_usage_claims');
    const col=await rawQuery("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='meter_usage_claims'");
    expect(col.map(v=>v.column_name)).toContain('identifier');
    expect(col.map(v=>v.column_name)).not.toContain('api_key');
    await db.initSchema();
  });
  it('allows exactly one concurrent selected-account event claim, never a replay',async()=>{
    const outcomes=await Promise.all([
      db.claimMeterUsageEvent(base),db.claimMeterUsageEvent(base),
      db.claimMeterUsageEvent({...base,requestKey:'rmcp_e3_altered'})]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(await db.confirmMeterUsageEvent(base)).toBe(true);
    expect(await db.confirmMeterUsageEvent(base)).toBe(false);
    expect(await db.claimMeterUsageEvent(base)).toBe(false);
    expect(await db.claimMeterUsageEvent({...base,meterId:'mtr_E3B'})).toBe(false);
    expect(await db.claimMeterUsageEvent({...base,account:other})).toBe(true);
    const row=await rawQuery("SELECT state,units::text AS units FROM meter_usage_claims WHERE stripe_account=$1 AND identifier=$2",
      [account,base.identifier]);
    expect(row).toEqual([{state:'provider_acknowledged',units:'5'}]);
  });
  it('retains uncertain reservations against old-key retries and account confusion',async()=>{
    const attempt={...base,identifier:'uncertain-usage-event-2',
      requestKey:'rmcp_e3_uncertain'};
    expect(await db.claimMeterUsageEvent(attempt)).toBe(true);
    expect(await db.claimMeterUsageEvent(attempt)).toBe(false);
    expect(await db.confirmMeterUsageEvent({...attempt,requestKey:'rmcp_wrong'}))
      .toBe(false);
    expect(await db.confirmMeterUsageEvent({...attempt,account:other}))
      .toBe(false);
    const rows=await rawQuery('SELECT state FROM meter_usage_claims WHERE stripe_account=$1 AND identifier=$2',
      [account,attempt.identifier]);
    expect(rows[0].state).toBe('pending');
  });
  it('requires separately signed-in single-use void approval without consuming money-out budget',async()=>{
    const key='rmcp_e3_credit_void_001',customer='cus_E3A',amount=900;
    const exact={account,idempotencyKey:key,tool:'credit_void_grant',
      target:customer,mode:'test',amountCents:amount,currency:'usd'};
    expect(await db.requestMoneyApproval({...exact,description:'Credit void exact terms'}))
      .toBe(true);
    expect(await db.consumeApprovedMoneyChange(exact)).toBe(false);
    expect(await db.approveMoneyRequest({account,idempotencyKey:key})).toBe(true);
    expect(await db.consumeApprovedMoneyChange({...exact,amountCents:901}))
      .toBe(false);
    expect(await db.consumeApprovedMoneyChange({...exact,account:other}))
      .toBe(false);
    expect(await db.consumeApprovedMoneyChange(exact)).toBe(true);
    expect(await db.consumeApprovedMoneyChange(exact)).toBe(false);
    const money=await rawQuery('SELECT id FROM money_reservations WHERE stripe_account=$1 AND request_key=$2',[account,key]);
    expect(money).toHaveLength(0);
  });
});
