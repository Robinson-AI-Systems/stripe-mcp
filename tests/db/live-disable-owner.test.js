import {describe,it,expect,beforeAll,afterAll} from 'vitest';
import pg from 'pg';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
let db,peer,other;
const account='acct_DISABLEPG',id='D'.repeat(32);
beforeAll(async()=>{
  const url=process.env.TEST_DATABASE_URL;
  if (!url || !['localhost','127.0.0.1','::1'].includes(new URL(url).hostname))
    throw Error('Disposable localhost PostgreSQL required');
  const schema=await openIsolatedSchema(url);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label,live_enabled) VALUES ($1,$2,TRUE),($3,$4,TRUE)',
    [account,'Selected','acct_UNRELATED','Unrelated']);
  peer=new pg.Client({connectionString:url});await peer.connect();
  await peer.query('SET search_path TO "'+schema+'"');
  other=createDb(async(parts,...params)=>{
    let s=parts[0];for(let i=0;i<params.length;i++)s+='$'+(i+1)+parts[i+1];
    return (await peer.query(s,params)).rows;
  });
});
afterAll(async()=>{await peer?.end();await closeIsolatedSchema();});
describe('B-8b2b1 Postgres atomic emergency LIVE disable',()=>{
  it('rejects missing/disabled accounts and does not disable on preview',async()=>{
    expect(await db.requestDisableLiveIntent({id:'X'.repeat(32),
      account:'acct_NOEXIST',expiresAt:new Date(Date.now()+600000)})).toBe(false);
    expect(await db.requestDisableLiveIntent({id,account,
      expiresAt:new Date(Date.now()+600000)})).toBe(true);
    expect((await db.getStripeAccount(account)).live_enabled).toBe(true);
  });
  it('permits one confirmation and one audit with two concurrent server instances',async()=>{
    const results=await Promise.all([
      db.consumeDisableLiveIntent(id),other.consumeDisableLiveIntent(id)
    ]);
    expect(results.sort()).toEqual([false,true]);
    expect((await db.getStripeAccount(account)).live_enabled).toBe(false);
    expect((await db.getStripeAccount('acct_UNRELATED')).live_enabled).toBe(true);
    const rows=await rawQuery('SELECT stripe_account,mode,tool,dry_run FROM change_log');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({stripe_account:account,mode:'live',
      tool:'stripe_disable_live',dry_run:false});
  });
  it('rejects used and expired intents',async()=>{
    expect(await db.consumeDisableLiveIntent(id)).toBe(false);
    const bad='B'.repeat(32);
    expect(await db.requestDisableLiveIntent({id:bad,account:'acct_UNRELATED',
      expiresAt:new Date(Date.now()-1000)})).toBe(true);
    expect(await db.consumeDisableLiveIntent(bad)).toBe(false);
    expect((await db.getStripeAccount('acct_UNRELATED')).live_enabled).toBe(true);
  });
});
