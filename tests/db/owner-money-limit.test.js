import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import pg from 'pg';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
let db,peer,other;
const account='acct_BUDGETPG',otherAccount='acct_OTHERBUDGET';
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw Error('Disposable localhost PostgreSQL only');
  const schema=await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts (id,label,test_key_enc,money_limit_cents) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)',
    [account,'Selected','fake-encrypted-account',50000,
      otherAccount,'Other','fake-encrypted-other',75000]);
  peer=new pg.Client({connectionString:url});await peer.connect();
  await peer.query('SET search_path TO "'+schema+'"');
  other=createDb(async(parts,...values)=>{
    let q=parts[0];for(let i=0;i<values.length;i++)q+='$'+(i+1)+parts[i+1];
    return (await peer.query(q,values)).rows;
  });
});
afterAll(async()=>{await peer?.end();await closeIsolatedSchema();});
describe('B-8b2b3 actual account-row serialization, budget and grants',()=>{
  it('rejects unconfigured account, invalid amounts, unchanged cap',async()=>{
    expect(await db.requestMoneyLimitIntent({id:'X'.repeat(32),account:'acct_UNKNOWN',
      newLimitCents:10000,expiresAt:new Date(Date.now()+600000)})).toBe(false);
    expect(await db.requestMoneyLimitIntent({id:'Y'.repeat(32),account,
      newLimitCents:50000,expiresAt:new Date(Date.now()+600000)})).toBe(false);
    await expect(db.requestMoneyLimitIntent({id:'Z'.repeat(32),account,
      newLimitCents:2147483648,expiresAt:new Date(Date.now()+600000)})).rejects.toThrow();
  });
  it('rejects one of two competing owner requests using exact previous cap',async()=>{
    const a='A'.repeat(32),b='B'.repeat(32);
    expect(await db.requestMoneyLimitIntent({id:a,account,newLimitCents:30000,
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    expect(await db.requestMoneyLimitIntent({id:b,account,newLimitCents:10000,
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    const results=await Promise.all([db.consumeMoneyLimitIntent(a),other.consumeMoneyLimitIntent(b)]);
    expect(results.sort()).toEqual([false,true]);
    const limit=(await db.getStripeAccount(account)).money_limit_cents;
    expect([30000,10000]).toContain(limit);
    expect((await db.getStripeAccount(otherAccount)).money_limit_cents).toBe(75000);
    const logs=await rawQuery("SELECT stripe_account,tool,before,after FROM change_log WHERE tool='stripe_set_money_limit'");
    expect(logs).toHaveLength(1);
    expect(logs[0].stripe_account).toBe(account);
    expect(logs[0].before.limit_cents).toBe(50000);
    expect(logs[0].after.limit_cents).toBe(limit);
  });
  it('still requires owner grant for every money-out plus override above new cap',async()=>{
    const limit=(await db.getStripeAccount(account)).money_limit_cents;
    const amountCents=limit+100;
    const args={account,connection:'agent-A',idempotencyKey:'after-cap-change',
      amountCents,currency:'usd'};
    expect((await db.reserveMoneyOut(args)).decision).toBe('owner_approval_required');
    expect(await db.requestMoneyApproval({account,idempotencyKey:args.idempotencyKey,
      amountCents,currency:'usd',target:'ch_FAKE1234',description:'Fake money-out safety test',
      tool:'stripe_fake_payout'})).toBe(true);
    expect((await db.reserveMoneyOut(args)).decision).toBe('owner_approval_required');
    expect(await db.approveMoneyRequest({account,idempotencyKey:args.idempotencyKey})).toBe(true);
    expect((await db.reserveMoneyOut(args)).decision).toBe('limit_exceeded_override_required');
    expect(await db.approveMoneyOverride({account,idempotencyKey:args.idempotencyKey})).toBe(true);
    expect((await db.reserveMoneyOut(args)).decision).toBe('reserved');
    expect(Number((await db.getMoneyUsage({account,connection:'agent-B'})).used_cents))
      .toBe(amountCents);
  });
  it('never applies expired or replayed owner cap intents',async()=>{
    const expired='E'.repeat(32);
    const old=(await db.getStripeAccount(otherAccount)).money_limit_cents;
    expect(await db.requestMoneyLimitIntent({id:expired,account:otherAccount,
      newLimitCents:90000,expiresAt:new Date(Date.now()-1000)})).toBe(true);
    expect(await db.consumeMoneyLimitIntent(expired)).toBe(false);
    expect((await db.getStripeAccount(otherAccount)).money_limit_cents).toBe(old);
  });
});
