import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { createDb } from '../../src/db.js';
import { openIsolatedSchema, closeIsolatedSchema, rawQuery, neonShapedQuery } from
  '../../test/helpers/pg-neon-adapter.js';

let db,other,secondDb;
beforeAll(async () => {
  const url=process.env.TEST_DATABASE_URL;
  if (!url || !['localhost','127.0.0.1','::1'].includes(new URL(url).hostname)) {
    throw new Error('Use only disposable localhost PostgreSQL');
  }
  const schema=await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts (id,label,live_key_enc) VALUES ($1,$2,$3)',
    ['acct_fake_live_pg','Isolated fixture','encrypted-fake-placeholder']);
  other=new pg.Client({connectionString:url});
  await other.connect();
  await other.query('SET search_path TO "'+schema+'"');
  secondDb=createDb(async(segments,...values)=>{
    let query=segments[0];
    for(let i=0;i<values.length;i++) query+='$'+(i+1)+segments[i+1];
    return (await other.query(query,values)).rows;
  });
});
afterAll(async()=>{await other?.end(); await closeIsolatedSchema();});

describe('B-2b PostgreSQL atomic two-step LIVE activation (fake key)',()=>{
  const account='acct_fake_live_pg';
  const intent=(id,offsetMs=600000)=>db.createLiveEnableIntent({
    account,id,expiresAt:new Date(Date.now()+offsetMs)
  });
  it('does not enable from creating an intent or missing the independent owner gate',async()=>{
    const id='A'.repeat(32);
    expect(await intent(id)).toBe(true);
    expect((await db.getLiveEnableIntent(id)).stripe_account).toBe(account);
    expect((await db.getStripeAccount(account)).live_enabled).toBe(false);
    expect(await db.consumeLiveEnableIntent({id,allowActivation:false})).toBe(false);
    expect((await db.getLiveEnableIntent(id))).not.toBeNull();
  });
  it('atomically consumes one intent across two serverless clients and writes an audit row',async()=>{
    const id='B'.repeat(32);
    await intent(id);
    const decisions=await Promise.all([
      db.consumeLiveEnableIntent({id,allowActivation:true}),
      secondDb.consumeLiveEnableIntent({id,allowActivation:true})
    ]);
    expect(decisions.sort()).toEqual([false,true]);
    expect((await db.getStripeAccount(account)).live_enabled).toBe(true);
    const logs=await rawQuery('SELECT tool,mode FROM change_log WHERE stripe_account = $1',
      [account]);
    expect(logs.filter(r=>r.tool==='stripe_enable_live')).toHaveLength(1);
    expect(await db.consumeLiveEnableIntent({id,allowActivation:true})).toBe(false);
  });
  it('rejects expiry and unknown tokens',async()=>{
    const id='C'.repeat(32);
    await intent(id,-1000);
    expect(await db.getLiveEnableIntent(id)).toBeNull();
    expect(await db.consumeLiveEnableIntent({id,allowActivation:true})).toBe(false);
    expect(await db.consumeLiveEnableIntent({id:'invalid',allowActivation:true})).toBe(false);
  });
});
