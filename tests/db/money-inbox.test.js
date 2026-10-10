import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery} from '../../test/helpers/pg-neon-adapter.js';
let db;
const account='acct_INBOXPG',other='acct_OTHERPG';
beforeAll(async()=>{
 const url=process.env.TEST_DATABASE_URL;
 if(!url||!['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
   throw Error('Disposable localhost PostgreSQL required');
 await openIsolatedSchema(url);db=createDb(neonShapedQuery());await db.initSchema();
 await rawQuery('INSERT INTO stripe_accounts (id,label) VALUES ($1,$2),($3,$4)',
  [account,'Fixture A',other,'Fixture B']);
});
afterAll(async()=>await closeIsolatedSchema());
const pending=(account,key,target='ch_FAKE1234',amountCents=12345)=>({
 account,idempotencyKey:key,tool:'stripe_test_refund',description:'Fake verified refund',
 amountCents,currency:'usd',target,mode:'test'
});
describe('B-8c1 PG exact target binding and private queries',()=>{
 it('binds target and amount to request key and refuses collisions and live mode',async()=>{
  expect(await db.requestMoneyApproval(pending(account,'safe-key'))).toBe(true);
  expect(await db.requestMoneyApproval(pending(account,'safe-key','ch_OTHER123'))).toBe(false);
  expect(await db.requestMoneyApproval(pending(account,'safe-key','ch_FAKE1234',12346))).toBe(false);
  await expect(db.requestMoneyApproval(pending(account,'bad-target','untrusted')))
    .rejects.toThrow();
  await expect(db.requestMoneyApproval({...pending(account,'live'),mode:'live'}))
    .rejects.toThrow();
 });
 it('keeps other accounts and legacy rows outside the owner inbox',async()=>{
  await db.requestMoneyApproval(pending(other,'other-key','ch_OTHER123'));
  await db.requestMoneyApproval(pending(account,'legacy-key','',100));
  const a=await db.listPendingMoneyApprovals({account,limit:10});
  expect(a.map(x=>x.request_key)).toEqual(['safe-key']);
  expect(a[0].target).toBe('ch_FAKE1234');
  expect((await db.listPendingMoneyApprovals({account:other})).map(x=>x.request_key))
    .toEqual(['other-key']);
  await expect(db.listPendingMoneyApprovals({account,limit:21})).rejects.toThrow();
  const row=(await rawQuery('SELECT target,mode FROM money_approvals WHERE request_key=$1',
    ['safe-key']))[0];
  expect(row).toEqual({target:'ch_FAKE1234',mode:'test'});
 });
 it('refuses any owner grant to a missing-target request',async()=>{
  expect(await db.approveMoneyRequest({account,idempotencyKey:'legacy-key'})).toBe(false);
  expect(await db.approveMoneyOverride({account,idempotencyKey:'legacy-key'})).toBe(false);
  expect(await db.approveMoneyRequest({account,idempotencyKey:'safe-key'})).toBe(true);
  expect(await db.approveMoneyOverride({account,idempotencyKey:'safe-key'})).toBe(true);
  const rows=await rawQuery(
    'SELECT request_key,approved_at FROM money_approvals WHERE stripe_account=$1',[account]);
  expect(rows.find(x=>x.request_key==='legacy-key').approved_at).toBeNull();
 });
});