import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createDb} from '../../src/db.js';
import {openIsolatedSchema,closeIsolatedSchema,rawQuery,neonShapedQuery}
  from '../../test/helpers/pg-neon-adapter.js';
const account='acct_RTCPASSDB',pass='rtc_pass_'+'A'.repeat(43);
let db;
beforeAll(async()=>{
  const dsn=process.env.TEST_DATABASE_URL;
  if(!dsn||!['localhost','127.0.0.1','::1'].includes(new URL(dsn).hostname))
    throw Error('Disposable local Postgres required');
  await openIsolatedSchema(dsn);
  db=createDb(neonShapedQuery());await db.initSchema();
  await rawQuery('INSERT INTO stripe_accounts(id,label) VALUES($1,$2)',[account,'TEST']);
});
afterAll(async()=>closeIsolatedSchema());
describe('RTC pass durable TEST read-only scope',()=>{
  it('persists only a token digest and atomically revokes',async()=>{
    const expiresAt=new Date(Date.now()+86400000);
    expect(await db.createRtcReadOnlyPass({id:'rtc-agent-fixture',account,token:pass,expiresAt})).toBe(true);
    const row=await db.getRtcPass(pass);
    expect(row).toMatchObject({kind:'pass',profile:'read_only',mode:'test',
      allow_writes:false,money_limit_cents:0,rate_limit_per_minute:120});
    const sqlRows=await rawQuery('SELECT token_hash,kind,allow_writes FROM oauth_tokens WHERE client_id=$1',
      ['rtc-agent-fixture']);
    expect(sqlRows).toHaveLength(1);
    expect(sqlRows[0].token_hash).not.toBe(pass);
    expect(sqlRows[0].allow_writes).toBe(false);
    expect(await db.revokeAccessToken(pass)).toBe(true);
    expect(await db.getRtcPass(pass)).toBeNull();
  });
});
