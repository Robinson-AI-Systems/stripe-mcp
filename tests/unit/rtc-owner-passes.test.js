import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createOneTimeStore} from '../../src/core/one-time-secrets.js';
import {createOwnerPassIssuer,RTC_PASS_PATTERN} from '../../src/core/rtc-passes.js';

const A='acct_OWNERPASS26';
async function setup({authorized=true}={}){
  const db=createFakeDb({accounts:[{id:A,label:'Original TEST'}]});
  await db.saveTestKey({account:A,label:'TEST',ciphertext:'v1.mock',
    kind:'restricted',last4:'FAKE'});
  const oneTimeStore=createOneTimeStore({db,encryptionKey:randomBytes(32)});
  const issuer=createOwnerPassIssuer({db,oneTimeStore,
    availableAreas:['server','account','billing','payments','workflows'],
    verifyOwner:async()=>authorized});
  return {db,issuer,oneTimeStore};
}
describe('R-1 explicit owner-selected TEST RTC delegation',()=>{
  it('defaults 24h read-only, zero money, private one-time reveal and 120/min',async()=>{
    const f=await setup();
    const result=await f.issuer({account:A,confirm:true});
    expect(result).toMatchObject({account:A,mode:'test',profile:'read_only',
      allowWrites:false,moneyLimitCents:0,forHub:false,rateLimitPerMinute:120,
      lifetimeHours:24,areas:['server']});
    expect(result.setupPath).toMatch(/^\/api\/stripe\/setup\?show=/);
    expect(JSON.stringify(result)).not.toContain('rtc_pass_');
    const secret=await f.oneTimeStore.consume(new URL(result.setupPath,
      'https://example.test').searchParams.get('show'));
    expect(RTC_PASS_PATTERN.test(secret)).toBe(true);
    expect(await f.oneTimeStore.consume(new URL(result.setupPath,
      'https://example.test').searchParams.get('show'))).toBe(null);
    expect(await f.db.getRtcPass(secret)).toMatchObject({mode:'test',
      profile:'read_only',kind:'pass',allow_writes:false,money_limit_cents:0,
      for_hub:false,rate_limit_per_minute:120});
    expect(await f.db.revokeAccessToken(secret)).toBe(true);
    expect(await f.db.getRtcPass(secret)).toBe(null);
  });
  it('supports an independently authenticated full TEST pass with explicit scoped delegated limits',async()=>{
    const f=await setup();
    const r=await f.issuer({account:A,confirm:true,profile:'full',
      allowWrites:true,moneyLimitCents:2500,rateLimitPerMinute:5,
      hours:720,areas:'payments,workflows'});
    expect(r).toMatchObject({profile:'full',allowWrites:true,
      moneyLimitCents:2500,rateLimitPerMinute:5,lifetimeHours:720,
      areas:['payments','workflows']});
    const secret=await f.oneTimeStore.consume(new URL(r.setupPath,
      'https://example.test').searchParams.get('show'));
    expect(await f.db.getRtcPass(secret)).toMatchObject({mode:'test',
      profile:'full',allow_writes:true,money_limit_cents:2500,
      rate_limit_per_minute:5,areas:['payments','workflows']});
    const outcomes=await Promise.all(Array.from({length:8},()=>f.db.consumeRtcPassRate({
      token:secret,limit:5,units:1})));
    expect(outcomes.filter(Boolean)).toHaveLength(5);
    expect(outcomes.filter(x=>!x)).toHaveLength(3);
  });
  it('keeps 365 days reserved for explicit Hub passes and never widens implicitly',async()=>{
    const f=await setup();
    await expect(f.issuer({account:A,confirm:true,hours:365*24}))
      .rejects.toThrow();
    const owner=await f.issuer({account:A,confirm:true,hours:365*24,
      forHub:true,profile:'everyday'});
    const secret=await f.oneTimeStore.consume(new URL(owner.setupPath,
      'https://example.test').searchParams.get('show'));
    expect(await f.db.getRtcPass(secret)).toMatchObject({for_hub:true,
      profile:'everyday',allow_writes:false,money_limit_cents:0});
  });
  it('refuses absent owner proof, unknown scope, read-only writes and LIVE impersonation',async()=>{
    const no=await setup({authorized:false});
    await expect(no.issuer({account:A,confirm:true})).rejects.toThrow(
      /owner confirmation/);
    const f=await setup();
    for(const values of [
      {confirm:false},{allowWrites:true},{profile:'read_only',allowWrites:true},
      {mode:'live'},{rateLimitPerMinute:601},{rateLimitPerMinute:0},
      {hours:721},{moneyLimitCents:100},{areas:'payments,payments'},
      {areas:'unregistered'},{forHub:true,hours:365*24+1}
    ]){
      await expect(f.issuer({account:A,confirm:true,...values}))
        .rejects.toThrow();
    }
    expect(await f.db.getRtcPassStatus('rtc_pass_not_an_issued_secret')).toBe(null);
  });
  it('revokes a stored pass if private one-time handoff fails',async()=>{
    const f=await setup();
    let revoked=false,created=null;
    const original=f.db.createRtcPass.bind(f.db);
    f.db.createRtcPass=async args=>{created=args;return original(args);};
    const revoke=f.db.revokeAccessToken.bind(f.db);
    f.db.revokeAccessToken=async value=>{revoked=true;return revoke(value);};
    const issuer=createOwnerPassIssuer({db:f.db,availableAreas:['server'],
      oneTimeStore:{issue:async()=>{throw new Error('private handoff failure');}},
      verifyOwner:async()=>true});
    await expect(issuer({account:A,confirm:true})).rejects.toThrow(
      /private handoff failure/);
    expect(revoked).toBe(true);
    expect(await f.db.getRtcPass(created.token)).toBe(null);
  });
});
