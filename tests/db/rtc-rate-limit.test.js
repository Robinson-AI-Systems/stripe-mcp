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
