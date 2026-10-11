import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {encryptSecret} from '../../src/core/crypto.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
const account='acct_REPLAYDB',other='acct_REPLAYOTHER';
const forwarderId='fwd_'+'f'.repeat(32),id='rpl_'+'a'.repeat(24);
const eventId='evt_TESTA',requestKey='replay-key-1',configDigest='d'.repeat(64);
let db;
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost Postgres required');
  await openIsolatedSchema(dsn);db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES ($1,$2),($3,$4)',
    [account,'Replay owner',other,'Other']);
  await db.ensureDevForwarder({accountId:account,id:forwarderId,requestKey:'config-1',
    url:'https://hooks.example.org/events',types:['customer.created'],
    configDigest:'c'.repeat(64),secretEnc:encryptSecret('FAKE SECRET',{
      aad:'fixture',key:Buffer.alloc(32,2)})});
});
afterAll(async()=>closeIsolatedSchema());
const options=()=>({accountId:account,forwarderId,requestKey,id,
  configDigest,eventIds:[eventId]});
describe('V-4c2 atomic original TEST Event replay reservations',()=>{
  it('schema is additive and stores only exact HTTP status, not event bodies or secrets',async()=>{
    expect(SCHEMA_TABLES).toContain('dev_forwarder_replays');
    expect(SCHEMA_TABLES).toContain('dev_forwarder_replay_events');
    await db.initSchema();
    const cols=await rawQuery(`SELECT column_name FROM information_schema.columns
      WHERE table_schema=current_schema()
        AND table_name='dev_forwarder_replay_events'`);
    expect(cols.map(x=>x.column_name)).not.toContain('secret_enc');
  });
  it('atomically reserves every event; same key never gives a second send permission',async()=>{
    expect(await db.reserveDevForwarderReplay(options())).toEqual({
      id,newlyReserved:true});
    const replay=await db.getDevForwarderReplay({accountId:account,requestKey});
    expect(replay).toMatchObject({id,forwarderId,eventIds:[eventId]});
    expect(replay.receipts).toMatchObject([{eventId,status:'reserved',statusCode:null}]);
    expect(await db.reserveDevForwarderReplay({...options(),id:'rpl_'+'b'.repeat(24)}))
      .toEqual({id,newlyReserved:false});
    await expect(db.reserveDevForwarderReplay({...options(),
      configDigest:'e'.repeat(64)})).rejects.toThrow(/different immutable/);
    expect(await db.getDevForwarderReplay({
      accountId:other,requestKey})).toBeNull();
  });
  it('marks attempt uncertain before send and records exact successful status only once',async()=>{
    expect(await db.markDevForwarderReplayAttempt({
      accountId:other,requestKey,id,eventId})).toBe(false);
    expect(await db.markDevForwarderReplayAttempt({
      accountId:account,requestKey,id,eventId})).toBe(true);
    expect(await db.markDevForwarderReplayAttempt({
      accountId:account,requestKey,id,eventId})).toBe(false);
    expect(await db.recordDevForwarderReplayReceipt({
      accountId:account,requestKey,id,eventId,status:'accepted',statusCode:202}))
      .toBe(true);
    expect(await db.recordDevForwarderReplayReceipt({
      accountId:account,requestKey,id,eventId,status:'accepted',statusCode:202}))
      .toBe(false);
    expect((await db.getDevForwarderReplay({accountId:account,requestKey}))
      .receipts[0]).toMatchObject({status:'accepted',statusCode:202});
  });
  it('denies foreign and soft-deleted forwarders before creating new attempted deliveries',async()=>{
    await expect(db.reserveDevForwarderReplay({...options(),accountId:other,
      requestKey:'foreign-replay',id:'rpl_'+'c'.repeat(24)}))
      .rejects.toThrow(/unavailable/);
    expect(await db.deleteDevForwarder({accountId:account,id:forwarderId}))
      .toBe(true);
    await expect(db.reserveDevForwarderReplay({...options(),
      requestKey:'deleted-replay',id:'rpl_'+'d'.repeat(24)}))
      .rejects.toThrow(/unavailable/);
  });
});
