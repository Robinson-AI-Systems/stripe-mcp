import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';

const account='acct_RTCMONEYCAP';
const makeToken=()=> 'rtc_pass_'+randomBytes(32).toString('base64url');
let db,peer,scope,token,zeroScope,revokedScope;
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Only disposable localhost PostgreSQL may run financial tests');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());peer=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label,test_key_enc,money_limit_cents) VALUES ($1,$2,$3,$4)',
    [account,'Disposable RTC TEST','v1.fake',50000]);
  token=makeToken();
  expect(await db.createRtcPass({id:'rtc-agent-financialcap',account,token,
    profile:'full',areas:['payments'],allowWrites:true,moneyLimitCents:2500,
    expiresAt:new Date(Date.now()+3600000)})).toBe(true);
  scope=(await db.getRtcPassStatus(token)).result_scope;
  const zero=makeToken();
  expect(await db.createRtcPass({id:'rtc-agent-financialzero',account,token:zero,
    profile:'full',areas:['payments'],allowWrites:true,moneyLimitCents:0,
    expiresAt:new Date(Date.now()+3600000)})).toBe(true);
  zeroScope=(await db.getRtcPassStatus(zero)).result_scope;
  const revoked=makeToken();
  expect(await db.createRtcPass({id:'rtc-agent-financialrevoked',account,token:revoked,
    profile:'full',areas:['payments'],allowWrites:true,moneyLimitCents:2500,
    expiresAt:new Date(Date.now()+3600000)})).toBe(true);
  revokedScope=(await db.getRtcPassStatus(revoked)).result_scope;
  expect(await db.revokeAccessToken(revoked)).toBe(true);
});
afterAll(async()=>closeIsolatedSchema());
async function approved(key,amount,connection=scope,client=db){
  expect(await client.requestMoneyApproval({account,idempotencyKey:key,
    tool:'stripe_fixture_guarded_refund',description:'Fixture provider-derived payout',
    target:'ch_FAKE12345',amountCents:amount,currency:'usd'})).toBe(true);
  expect(await client.approveMoneyRequest({account,idempotencyKey:key})).toBe(true);
  return client.reserveMoneyOut({account,connection,idempotencyKey:key,
    amountCents:amount,currency:'usd'});
}
describe('R-2 atomic service-owned delegated money ceiling',()=>{
  it('preserves independent owner money approval even with a positive pass ceiling',async()=>{
    const decision=await db.reserveMoneyOut({account,connection:scope,
      idempotencyKey:'no-owner-approval',amountCents:100,currency:'usd'});
    expect(decision.decision).toBe('owner_approval_required');
  });
  it('refuses a full write pass with zero delegated money and revoked passes',async()=>{
    expect((await approved('zero-cap',100,zeroScope)).decision).toBe('delegated_pass_denied');
    expect((await approved('revoked-cap',100,revokedScope)).decision).toBe('delegated_pass_denied');
  });
  it('serializes independent instances against the SAME pass ceiling and account ledger',async()=>{
    const responses=await Promise.all([
      approved('simul-a',1600,scope,db),
      approved('simul-b',1600,scope,peer)
    ]);
    expect(responses.map(x=>x.decision).sort()).toEqual([
      'delegated_limit_exceeded','reserved']);
    expect(Number((await db.getMoneyUsage({account,connection:scope})).used_cents))
      .toBe(1600);
    const allowed=await approved('remaining',900);
    expect(allowed.decision).toBe('reserved');
    expect((await approved('over-by-one',1)).decision).toBe('delegated_limit_exceeded');
    expect(Number((await db.getMoneyUsage({account,connection:scope})).used_cents))
      .toBe(2500);
  });
  it('never authorizes a change to an already reserved request or skips the original cap',async()=>{
    expect((await db.reserveMoneyOut({account,connection:scope,
      idempotencyKey:'remaining',amountCents:901,currency:'usd'})).decision)
      .toBe('delegated_limit_exceeded');
    const rows=await rawQuery('SELECT amount_cents,connection,state FROM money_reservations WHERE stripe_account=$1',
      [account]);
    expect(rows).toHaveLength(2);
    expect(rows.every(x=>x.connection===scope&&x.state==='reserved')).toBe(true);
  });
});
