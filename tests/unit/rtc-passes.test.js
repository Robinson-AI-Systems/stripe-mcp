import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createOneTimeStore} from '../../src/core/one-time-secrets.js';
import {createReadOnlyTestPassIssuer,RTC_PASS_PATTERN} from '../../src/core/rtc-passes.js';
const account='acct_READONLYRTC';
describe('owner-created RTC short-lived TEST pass',()=>{
  it('is cryptographic, hashed in persistence, shown only once and revocable',async()=>{
    const db=createFakeDb({accounts:[{id:account}]});
    await db.saveTestKey({account,label:'TEST',ciphertext:'v1.mock',kind:'restricted',last4:'FAKE'});
    const once=createOneTimeStore({db,encryptionKey:randomBytes(32)});
    const issuer=createReadOnlyTestPassIssuer({db,oneTimeStore:once,now:()=>Date.now()});
    const issued=await issuer({account});
    expect(issued).toMatchObject({account,mode:'test',profile:'read_only',
      allowWrites:false,moneyLimitCents:0});
    expect(issued.setupPath).toMatch(/^\/api\/stripe\/setup\?show=/);
    expect(JSON.stringify(issued)).not.toContain('rtc_pass_');
    const reveal=await once.consume(new URL(issued.setupPath,'https://example.test').searchParams.get('show'));
    expect(RTC_PASS_PATTERN.test(reveal)).toBe(true);
    expect((await db.getRtcPass(reveal))).toMatchObject({mode:'test',profile:'read_only',
      kind:'pass',allow_writes:false,money_limit_cents:0,rate_limit_per_minute:120});
    expect(await db.revokeAccessToken(reveal)).toBe(true);
    expect(await db.getRtcPass(reveal)).toBeNull();
  });
  it('refuses unconnected, LIVE, and invalid accounts without issuing anything',async()=>{
    const db=createFakeDb({accounts:[{id:account,live_enabled:true}]});
    const once={issue:()=>{throw Error('unexpected');}};
    const issuer=createReadOnlyTestPassIssuer({db,oneTimeStore:once});
    await expect(issuer({account})).rejects.toThrow();
    await expect(issuer({account:'invalid'})).rejects.toThrow();
  });
});
