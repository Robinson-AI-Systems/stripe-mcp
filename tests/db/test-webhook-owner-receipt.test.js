import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
let db;
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost Postgres required');
  await openIsolatedSchema(dsn);db=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label,test_key_enc) VALUES($1,$2,$3)',
    ['acct_RECEIPTOWNER','TEST','v1.fake']);
});
afterAll(async()=>closeIsolatedSchema());
describe('owner signed TEST receipt persistence and isolation',()=>{
  it('stores only verified receipt metadata and scopes by all three identifiers',async()=>{
    const selector={account:'acct_RECEIPTOWNER',endpoint:'we_RECEIPTOWNER',
      eventId:'evt_RECEIPTOWNER'};
    expect(await db.recordTestWebhookReceipt({...selector,eventType:'invoice.paid'}))
      .toBe(true);
    expect(await db.recordTestWebhookReceipt({...selector,eventType:'invoice.paid'}))
      .toBe(false);
    const stored=await db.getTestWebhookReceipt(selector);
    expect(stored).toMatchObject({eventId:selector.eventId,eventType:'invoice.paid'});
    expect(stored.receivedAt).toBeTruthy();
    expect(Object.keys(stored).sort()).toEqual(['eventId','eventType','receivedAt']);
    for(const override of [{endpoint:'we_OTHER'},{eventId:'evt_OTHER'}]){
      expect(await db.getTestWebhookReceipt({...selector,...override})).toBeNull();
    }
  });
});
