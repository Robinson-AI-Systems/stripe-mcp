import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
const account='acct_RTC_LIMIT',token='rtc_pass_'+randomBytes(32).toString('base64url');
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
    expiresAt:new Date(Date.now()+86400000)})).toBe(true);
});
afterAll(async()=>closeIsolatedSchema());
describe('atomic shared RTC pass rate ceiling',()=>{
  it('allows exactly 120 overlapping calls from two independent DB instances',async()=>{
    const results=await Promise.all(Array.from({length:150},(_,i)=>
      (i%2?db:peer).consumeRtcPassRate({token,limit:120})));
    expect(results.filter(Boolean)).toHaveLength(120);
    expect(results.filter(x=>!x)).toHaveLength(30);
  });
});
