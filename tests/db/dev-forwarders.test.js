import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb,SCHEMA_TABLES} from '../../src/db.js';
import {encryptSecret,decryptSecret} from '../../src/core/crypto.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
const account='acct_FORWARDFAKE',other='acct_OTHERFORWARD';
const id='fwd_'+'a'.repeat(32),url='https://hooks.example.org/stripe/events';
const types=['customer.created','invoice.payment_failed'];
const configDigest='b'.repeat(64);
const key=Buffer.alloc(32,7),aad='stripe-dev-forwarder/fixture';
const secretEnc=encryptSecret('FAKE synthetic signing material',{
  aad,key
});
const requestKey='forwarder-demo-1';
const row=()=>({accountId:account,id,url,types,configDigest,
  secretEnc,requestKey});
let db;
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost Postgres required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES ($1,$2),($3,$4)',
    [account,'Forwarder owner',other,'Different Stripe account']);
});
afterAll(async()=>closeIsolatedSchema());
describe('V-4b1 durable encrypted TEST forwarder store',()=>{
  it('adds one idempotent table with no plaintext secret field',async()=>{
    expect(SCHEMA_TABLES).toContain('dev_forwarders');
    await db.initSchema();
    const cols=await rawQuery(`SELECT column_name FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name='dev_forwarders'`);
    const names=cols.map(x=>x.column_name);
    expect(names).toContain('secret_enc');
    expect(names).not.toContain('secret');
    expect(names).not.toContain('secret_plaintext');
  });
  it('idempotently inserts once per selected account/requestKey',async()=>{
    const first=await db.ensureDevForwarder(row());
    expect(first.newlyCreated).toBe(true);
    expect(first).not.toHaveProperty('secret_enc');
    const duplicate=await db.ensureDevForwarder({...row(),
      secretEnc:encryptSecret('some other FAKE',{aad,key})});
    expect(duplicate.newlyCreated).toBe(false);
    expect(duplicate.id).toBe(first.id);
    const stored=await rawQuery('SELECT secret_enc FROM dev_forwarders WHERE id=$1',[id]);
    expect(stored).toHaveLength(1);
    expect(stored[0].secret_enc).not.toContain('FAKE synthetic signing material');
    expect(decryptSecret(stored[0].secret_enc,{aad,key}))
      .toBe('FAKE synthetic signing material');
    await expect(db.ensureDevForwarder({...row(),configDigest:'c'.repeat(64)}))
      .rejects.toThrow(/another immutable/);
  });
  it('never leaks ciphertext from public list or scoped public getter',async()=>{
    const listed=await db.listDevForwarders({accountId:account});
    expect(listed.map(x=>x.id)).toEqual([id]);
    expect(JSON.stringify(listed)).not.toContain('secret_enc');
    expect(JSON.stringify(listed)).not.toContain(secretEnc);
    const safe=await db.getDevForwarder({accountId:account,id});
    expect(safe.id).toBe(id);
    expect(safe).not.toHaveProperty('secret_enc');
    const privateRecord=await db.getDevForwarderForDelivery({
      accountId:account,id
    });
    expect(privateRecord.secret_enc).toBe(secretEnc);
    expect(await db.getDevForwarder({accountId:other,id})).toBeNull();
    expect(await db.getDevForwarderForDelivery({
      accountId:other,id
    })).toBeNull();
  });
  it('rejects invalid account/ID, unsafe URL, unordered filters or raw secret',async()=>{
    for(const changes of [
      {accountId:'acct_bad !'},{id:'fwd_wrong'},
      {url:'http://127.0.0.1/private'},
      {url:'https://hooks.example.org/stripe?token=SECRET'},
      {types:['invoice.payment_failed','customer.created']},
      {types:['customer.created','customer.created']},
      {types:[]},{secretEnc:'not-encrypted'},{configDigest:'wrong'}
    ])await expect(db.ensureDevForwarder({...row(),requestKey:'negative-'+
      Object.keys(changes)[0]+String(Math.random()),...changes}))
      .rejects.toThrow();
    await expect(db.listDevForwarders({accountId:account,limit:200}))
      .rejects.toThrow();
  });
  it('soft-deletes by exact account without allowing future delivery',async()=>{
    expect(await db.deleteDevForwarder({accountId:other,id})).toBe(false);
    expect(await db.markDevForwarderUsed({accountId:account,id})).toBe(true);
    expect(await db.deleteDevForwarder({accountId:account,id})).toBe(true);
    expect(await db.deleteDevForwarder({accountId:account,id})).toBe(false);
    expect(await db.getDevForwarder({accountId:account,id})).toBeNull();
    expect(await db.getDevForwarderForDelivery({accountId:account,id}))
      .toBeNull();
    expect(await db.listDevForwarders({accountId:account})).toEqual([]);
    expect((await db.getDevForwarder({
      accountId:account,id,includeDeleted:true
    })).deleted_at).toBeTruthy();
    await expect(db.ensureDevForwarder(row()))
      .rejects.toThrow(/another immutable or deleted/);
  });
});
