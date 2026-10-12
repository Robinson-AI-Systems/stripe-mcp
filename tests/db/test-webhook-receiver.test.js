import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
let db;
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES($1,$2),($3,$4)',
    ['acct_RECEIPTA','A','acct_RECEIPTB','B']);
});
afterAll(async()=>closeIsolatedSchema());
describe('durable TEST webhook delivery metadata',()=>{
  it('atomically deduplicates per account and endpoint, keeping no payload',async()=>{
    expect(SCHEMA_TABLES).toContain('test_webhook_receipts');
    const p={account:'acct_RECEIPTA',endpoint:'we_RECEIPT',
      eventId:'evt_RECEIPT',eventType:'invoice.paid'};
    expect(await db.recordTestWebhookReceipt(p)).toBe(true);
    expect(await db.recordTestWebhookReceipt(p)).toBe(false);
    expect(await db.getTestWebhookReceipt(p)).toMatchObject({
      eventId:p.eventId,eventType:p.eventType});
    expect(await db.getTestWebhookReceipt({...p,account:'acct_RECEIPTB'})).toBeNull();
    const columns=await rawQuery(`SELECT column_name FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name='test_webhook_receipts'`);
    expect(columns.map(x=>x.column_name).sort()).toEqual([
      'endpoint_id','event_id','event_type','received_at','stripe_account']);
    expect(await db.recordTestWebhookReceipt({...p,endpoint:'we_OTHER'})).toBe(true);
  });
});
