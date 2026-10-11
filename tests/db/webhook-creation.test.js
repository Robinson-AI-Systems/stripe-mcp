import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
const a='acct_WEBHOOKFAKE',b='acct_OTHERWEBHOOK',key='safe-request',digest='a'.repeat(64);
let db;
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost Postgres required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES($1,$2),($3,$4)',
    [a,'Test owner',b,'Other owner']);
});
afterAll(async()=>closeIsolatedSchema());
describe('G-4d native webhook immutable create reservation',()=>{
  it('creates additive schema with no secret columns',async()=>{
    expect(SCHEMA_TABLES).toContain('webhook_create_intents');
    await db.initSchema();
    const names=(await rawQuery(`SELECT column_name FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name='webhook_create_intents'`))
      .map(x=>x.column_name);
    expect(names).toContain('config_digest');
    expect(names).not.toContain('secret');
    expect(names).not.toContain('secret_enc');
  });
  it('permits one reservation per account and key, no duplicate POST lease',async()=>{
    const p={accountId:a,requestKey:key,digest};
    expect(await db.reserveWebhookCreate(p)).toEqual({
      newlyReserved:true,state:'reserved',endpointId:null});
    expect(await db.reserveWebhookCreate(p)).toEqual({
      newlyReserved:false,state:'reserved',endpointId:null});
    await expect(db.reserveWebhookCreate({...p,digest:'b'.repeat(64)}))
      .rejects.toThrow(/different configuration/);
    expect(await db.completeWebhookCreate({...p,endpointId:'we_FAKE123'})).toBe(true);
    expect(await db.completeWebhookCreate({...p,endpointId:'we_FAKE123'})).toBe(false);
    expect(await db.getWebhookCreate(p)).toEqual({
      state:'confirmed',endpointId:'we_FAKE123'});
    expect(await db.reserveWebhookCreate(p)).toMatchObject({
      newlyReserved:false,state:'confirmed',endpointId:'we_FAKE123'});
    expect(await db.getWebhookCreate({...p,accountId:b})).toBeNull();
    expect((await db.reserveWebhookCreate({...p,accountId:b})).newlyReserved).toBe(true);
  });
  it('rejects unsupported identifiers before persistence',async()=>{
    await expect(db.reserveWebhookCreate({accountId:'bad',requestKey:key,digest}))
      .rejects.toThrow();
    await expect(db.completeWebhookCreate({accountId:a,requestKey:key,digest,
      endpointId:'not-a-provider-object'})).rejects.toThrow();
  });
});
