import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
const account='acct_RTCLIMIT',token='rtc_pass_'+randomBytes(32).toString('base64url');
let db,peer;
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable localhost Postgres required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());peer=createDb(neonShapedQuery());
  await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label,test_key_enc) VALUES($1,$2,$3)',
    [account,'TEST','v1.mock']);
  expect(await db.createRtcReadOnlyPass({id:'rtc-agent-ratetests',account,token,
    expiresAt:new Date(Date.now()+86400000),areas:['server','account']})).toBe(true);
  expect((await db.getRtcPassStatus(token)).areas).toEqual(['server','account']);
});
afterAll(async()=>closeIsolatedSchema());
describe('atomic shared RTC pass rate ceiling',()=>{
  it('allows exactly 120 overlapping calls from two independent DB instances',async()=>{
    const results=await Promise.all(Array.from({length:150},(_,i)=>
      (i%2?db:peer).consumeRtcPassRate({token,limit:120})));
    expect(results.filter(Boolean)).toHaveLength(120);
    expect(results.filter(x=>!x)).toHaveLength(30);
  });
  it('never allocates an initial multi-read batch beyond the owner cap',async()=>{
    const short='rtc_pass_'+randomBytes(32).toString('base64url');
    expect(await db.createRtcPass({id:'rtc-agent-rate-unitcap',account,token:short,
      profile:'read_only',areas:['server'],rateLimitPerMinute:5,
      expiresAt:new Date(Date.now()+3600000)})).toBe(true);
    expect(await db.consumeRtcPassRate({token:short,limit:5,units:10})).toBe(false);
    expect(await db.consumeRtcPassRate({token:short,limit:5,units:5})).toBe(true);
    expect(await peer.consumeRtcPassRate({token:short,limit:5,units:1})).toBe(false);
    const rows=await rawQuery('SELECT count FROM rtc_pass_rates WHERE token_hash=$1',
      [(await rawQuery('SELECT token_hash FROM oauth_tokens WHERE client_id=$1',
        ['rtc-agent-rate-unitcap']))[0].token_hash]);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(5);
  });
  it('sweeps expired rate-window rows without affecting current pass grants',async()=>{
    const hash=(await rawQuery('SELECT token_hash FROM oauth_tokens WHERE client_id=$1',
      ['rtc-agent-ratetests']))[0].token_hash;
    await rawQuery("INSERT INTO rtc_pass_rates(token_hash,window_start,count) VALUES ($1,date_trunc('minute',now())-interval '2 hours',7)",
      [hash]);
    expect(await db.consumeRtcPassRate({token,limit:120})).toBe(false);
    const stale=await rawQuery("SELECT count FROM rtc_pass_rates WHERE token_hash=$1 AND window_start<date_trunc('minute',now())-interval '1 hour'",[hash]);
    expect(stale).toHaveLength(0);
  });
  it('revokes a TEST RTC pass through the existing independent owner intent',async()=>{
    const id='B'.repeat(32);
    expect(await db.requestConnectionRevokeIntent({id,account,
      clientId:'rtc-agent-ratetests',expiresAt:new Date(Date.now()+600000)})).toBe(true);
    expect(await db.getConnectionRevokeIntent(id)).toBeTruthy();
    expect(await db.consumeConnectionRevokeIntent(id)).toBe(true);
    expect((await db.getRtcPassStatus(token)).revoked_at).toBeTruthy();
    expect(await db.getRtcPass(token)).toBeNull();
    expect(await db.consumeConnectionRevokeIntent(id)).toBe(false);
  });
});

describe('atomic RTC batch-unit reservations',()=>{
  it('allows exactly twelve concurrent 10-read batches across DB handles',async()=>{
    const otherToken='rtc_pass_'+randomBytes(32).toString('base64url');
    expect(await db.createRtcReadOnlyPass({id:'rtc-agent-rate-batches',account,
      token:otherToken,areas:['server'],expiresAt:new Date(Date.now()+3600000)})).toBe(true);
    const results=await Promise.all(Array.from({length:13},(_,i)=>
      (i%2?db:peer).consumeRtcPassRate({token:otherToken,limit:120,units:10})));
    expect(results.filter(Boolean)).toHaveLength(12);
    expect(results.filter(x=>!x)).toHaveLength(1);
    for(const units of [0,11,-1,1.5,'10'])
      await expect(db.consumeRtcPassRate({token:otherToken,limit:120,units}))
        .rejects.toThrow('Valid RTC TEST rate selector');
  });
});
