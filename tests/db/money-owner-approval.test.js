import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery} from '../../test/helpers/pg-neon-adapter.js';

let db;
const account='acct_OWNERPG',other='acct_OTHERPG';
const key=(label)=>('A'.repeat(32)+label).slice(0,48);
async function pending(k,amountCents=1,target='ch_TEST123',a=account){
  return db.requestMoneyApproval({account:a,idempotencyKey:k,tool:'stripe_test_refund',
    description:'Verified TEST provider money request',amountCents,
    currency:'usd',target,mode:'test'});
}
async function stage(id,requestKey,kind='approve',a=account){
  return db.requestMoneyDecisionIntent({id:key(id),account:a,idempotencyKey:requestKey,
    kind,expiresAt:new Date(Date.now()+5*60*1000)});
}
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  for(const a of [account,other])
    await db.saveTestKey({account:a,label:a,ciphertext:'fixture-'+a,
      kind:'restricted',last4:'FAKE'});
});
afterAll(async()=>await closeIsolatedSchema());

describe('B-8c2 real PostgreSQL owner approval transactional boundaries',()=>{
  it('stores a TEST-only exact snapshot and consumes a grant with exactly one audit even under races',async()=>{
    expect(await pending('one-cent',1)).toBe(true);
    expect(await stage('first-intent','one-cent')).toBe(true);
    const snap=await db.getMoneyDecisionIntent(key('first-intent'));
    expect(snap).toMatchObject({kind:'approve',stripe_account:account,
      request_key:'one-cent',target:'ch_TEST123',amount_cents:'1',mode:'test'});
    const results=await Promise.all([
      db.consumeMoneyDecisionIntent(key('first-intent')),
      db.consumeMoneyDecisionIntent(key('first-intent'))]);
    expect(results.sort()).toEqual([false,true]);
    expect(await db.consumeMoneyDecisionIntent(key('first-intent'))).toBe(false);
    const rows=await rawQuery(`SELECT tool,target,amount_cents
      FROM change_log WHERE stripe_account=$1 AND tool='owner_approve_money_out'`,[account]);
    expect(rows).toHaveLength(1);
    expect(rows[0].target).toBe('ch_TEST123');
    const reserved=await db.reserveMoneyOut({account,connection:'client-1',
      idempotencyKey:'one-cent',amountCents:1,currency:'usd'});
    expect(reserved.decision).toBe('reserved');
    const replay=await db.reserveMoneyOut({account,connection:'client-2',
      idempotencyKey:'one-cent',amountCents:1,currency:'usd'});
    expect(replay.decision).toBe('already_reserved');
  });
  it('refuses altered identity, cross-account requests, expired and legacy targetless grants',async()=>{
    expect(await pending('altered',10,'ch_ORIGINAL')).toBe(true);
    expect(await stage('change-intent','altered')).toBe(true);
    await rawQuery('UPDATE money_approvals SET target=$1 WHERE request_key=$2',
      ['ch_CHANGED','altered']);
    expect(await db.consumeMoneyDecisionIntent(key('change-intent'))).toBe(false);
    expect(await stage('wrong-account','altered','approve',other)).toBe(false);
    expect(await pending('legacy',10,'')).toBe(true);
    expect(await stage('legacy-intent','legacy')).toBe(false);
    expect(await pending('expired',10)).toBe(true);
    expect(await stage('expiry-intent','expired')).toBe(true);
    await rawQuery(`UPDATE owner_money_decision_intents SET expires_at=now()-interval '1 second'
      WHERE id=$1`,[key('expiry-intent')]);
    expect(await db.consumeMoneyDecisionIntent(key('expiry-intent'))).toBe(false);
    expect(await db.approveMoneyRequest({account,idempotencyKey:'legacy'})).toBe(false);
    const audits=await rawQuery(`SELECT id FROM change_log
      WHERE tool='owner_approve_money_out' AND idempotency_key IN ('altered','legacy','expired')`);
    expect(audits).toHaveLength(0);
  });
  it('requires distinct above-cap owner action and protects account cap with concurrent reservations',async()=>{
    expect(await pending('over-cap',50001)).toBe(true);
    expect(await stage('over-approval','over-cap')).toBe(true);
    expect(await db.consumeMoneyDecisionIntent(key('over-approval'))).toBe(true);
    expect((await db.reserveMoneyOut({account,connection:'client-1',
      idempotencyKey:'over-cap',amountCents:50001,currency:'usd'})).decision)
      .toBe('limit_exceeded_override_required');
    expect(await stage('over-intent','over-cap','override')).toBe(true);
    const result=await Promise.all([
      db.consumeMoneyDecisionIntent(key('over-intent')),
      db.consumeMoneyDecisionIntent(key('over-intent'))]);
    expect(result.sort()).toEqual([false,true]);
    const attempts=await Promise.all([
      db.reserveMoneyOut({account,connection:'client-1',
        idempotencyKey:'over-cap',amountCents:50001,currency:'usd'}),
      db.reserveMoneyOut({account,connection:'client-2',
        idempotencyKey:'over-cap',amountCents:50001,currency:'usd'})
    ]);
    expect(attempts.map(x=>x.decision).sort()).toEqual(['already_reserved','reserved']);
    const audits=await rawQuery(`SELECT id FROM change_log
      WHERE tool='owner_override_money_out' AND idempotency_key='over-cap'`);
    expect(audits).toHaveLength(1);
    const saved=await rawQuery(`SELECT money_limit_cents FROM stripe_accounts WHERE id=$1`,[account]);
    expect(saved[0].money_limit_cents).toBe(50000);
  });
});
