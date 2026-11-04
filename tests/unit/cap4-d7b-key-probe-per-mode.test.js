// CAP-4 D7b — the key-permission probe, per mode. D-7 converted the
// admin reads but flagged this one leg: the probe persisted through
// db.updateKeyPermissions, which matched only test_key_enc and wrote
// the single shared key_permissions/key_checked_at columns, so a LIVE
// probe could neither run nor persist without falsifying the record
// the other mode reads. D7b splits the record per mode: the baseline
// columns are the TEST record by construction (their only writers
// were TEST-matched), new live_key_permissions/live_key_checked_at
// columns start NULL (never probed), the reprobe service verifies
// and persists in the connection's own mode, the handler passes the
// connection mode through, and stripe_whoami reports the connection
// mode's own stored record (nulls when that mode was never probed —
// never the other mode's result). Baseline accounting is recorded in
// the D7b card: at the pristine baseline the LIVE legs fail (the
// handler and the service refuse LIVE outright) and the TEST pins
// pass, because TEST was already fully served.
import {describe,expect,it,vi} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createKeyStore,createPermissionReprobe} from '../../src/keys.js';
import {handlers,tools} from '../../src/tools/server.js';
const parse=r=>JSON.parse(r.content[0].text);
const acct='acct_D7BOWNER';
const CLOCK_MS=Date.parse('2026-11-04T12:00:00.000Z');
const CLOCK_ISO='2026-11-04T12:00:00.000Z';
const fakeDb=()=>createFakeDb({clock:()=>CLOCK_MS,
  accounts:[{id:acct,label:'D7b fixture',live_enabled:true}]});
const clientFor=(mode,account=acct)=>({
  accounts:{retrieve:async()=>({object:'account',id:account,
    livemode:mode==='live'})},
  balance:{retrieve:async()=>({object:'balance',livemode:mode==='live'})}
});
const reprobeFor=(db,{mode,ciphertext,probeResult})=>createPermissionReprobe({
  db,
  keyStoreFactory:()=>({loadKeySnapshot:async({account:a,mode:m})=>{
    expect(a).toBe(acct);expect(m).toBe(mode);
    return {key:mode==='test'?'rk_test_FAKEKEY':'rk_live_FAKEKEY',
      expectedCiphertext:ciphertext};
  }}),
  makeClient:({key,mode:m})=>{
    expect(m).toBe(mode);
    expect(key).toBe(mode==='test'?'rk_test_FAKEKEY':'rk_live_FAKEKEY');
    return clientFor(mode);
  },
  probe:async()=>probeResult
});
const whoami=async(db,mode)=>parse(await handlers.stripe_whoami({},
  {db,connection:{stripeAccount:acct,mode,profile:'read_only'}}));

describe('CAP-4 D7b probe service: per-mode persistence',()=>{
  it('probes the TEST key and persists the TEST record only',async()=>{
    const db=fakeDb();
    await db.saveTestKey({account:acct,label:'D7b fixture',
      ciphertext:'test-cipher',kind:'restricted',last4:'TEST',
      permissions:{customers:'denied'}});
    const probe=reprobeFor(db,{mode:'test',ciphertext:'test-cipher',
      probeResult:{customers:'ok',refunds:'denied'}});
    const result=await probe({account:acct,mode:'test'});
    expect(result).toMatchObject({account:acct,mode:'test',
      permissions:{customers:'ok',refunds:'denied'}});
    expect(Number.isFinite(Date.parse(result.checkedAt))).toBe(true);
    const row=await db.getStripeAccount(acct);
    expect(row.key_permissions).toEqual({customers:'ok',refunds:'denied'});
    expect(row.key_checked_at).toBe(CLOCK_ISO);
    expect(row.live_key_permissions).toBeNull();
    expect(row.live_key_checked_at).toBeNull();
  });
  it('probes the LIVE key and persists the LIVE record only',async()=>{
    const db=fakeDb();
    await db.saveTestKey({account:acct,label:'D7b fixture',
      ciphertext:'test-cipher',kind:'restricted',last4:'TEST',
      permissions:{customers:'denied'}});
    await db.saveLiveKey({account:acct,ciphertext:'live-cipher',
      kind:'restricted',last4:'LIVE'});
    const probe=reprobeFor(db,{mode:'live',ciphertext:'live-cipher',
      probeResult:{payments:'ok',customers:'denied'}});
    const result=await probe({account:acct,mode:'live'});
    expect(result).toMatchObject({account:acct,mode:'live',
      permissions:{payments:'ok',customers:'denied'}});
    const row=await db.getStripeAccount(acct);
    expect(row.live_key_permissions).toEqual({payments:'ok',customers:'denied'});
    expect(row.live_key_checked_at).toBe(CLOCK_ISO);
    // The TEST record is exactly what TEST enrollment left behind.
    expect(row.key_permissions).toEqual({customers:'denied'});
    expect(row.key_checked_at).toBe(CLOCK_ISO);
  });
  it('fails closed when the owner rotates the LIVE key during the probes',async()=>{
    const db=fakeDb();
    await db.saveLiveKey({account:acct,ciphertext:'live-cipher',
      kind:'restricted',last4:'LIVE'});
    const probe=createPermissionReprobe({db,
      keyStoreFactory:()=>({loadKeySnapshot:async()=>({
        key:'rk_live_FAKEKEY',expectedCiphertext:'live-cipher'})}),
      makeClient:()=>clientFor('live'),
      probe:async()=>{
        await db.saveLiveKey({account:acct,ciphertext:'rotated-cipher',
          kind:'restricted',last4:'NEW4'});
        return {customers:'ok'};
      }});
    await expect(probe({account:acct,mode:'live'}))
      .rejects.toThrow(/could not be updated/);
    expect((await db.getStripeAccount(acct)).live_key_permissions).toBeNull();
  });
  it('refuses a LIVE probe whose provider identity is not LIVE',async()=>{
    const db=fakeDb();
    await db.saveLiveKey({account:acct,ciphertext:'live-cipher',
      kind:'restricted',last4:'LIVE'});
    let probed=0;
    const probe=createPermissionReprobe({db,
      keyStoreFactory:()=>({loadKeySnapshot:async()=>({
        key:'rk_live_FAKEKEY',expectedCiphertext:'live-cipher'})}),
      makeClient:()=>clientFor('test'),
      probe:async()=>{probed++;return {customers:'ok'};}});
    await expect(probe({account:acct,mode:'live'}))
      .rejects.toThrow(/identity could not be verified/);
    expect(probed).toBe(0);
    expect((await db.getStripeAccount(acct)).live_key_permissions).toBeNull();
  });
  it('refuses a LIVE probe when the account is not LIVE-enabled at persistence',async()=>{
    const db=createFakeDb({clock:()=>CLOCK_MS,
      accounts:[{id:acct,label:'D7b fixture',live_enabled:false}]});
    await db.saveLiveKey({account:acct,ciphertext:'live-cipher',
      kind:'restricted',last4:'LIVE'});
    const probe=reprobeFor(db,{mode:'live',ciphertext:'live-cipher',
      probeResult:{customers:'ok'}});
    await expect(probe({account:acct,mode:'live'}))
      .rejects.toThrow(/could not be updated/);
    expect((await db.getStripeAccount(acct)).live_key_permissions).toBeNull();
  });
  it('keeps the real key store production gate for LIVE snapshots',async()=>{
    const db=fakeDb();
    const probe=createPermissionReprobe({db,
      keyStoreFactory:({db:inner})=>createKeyStore({db:inner,
        encryptionKey:Buffer.alloc(32,7)})});
    await expect(probe({account:acct,mode:'live'}))
      .rejects.toThrow(/not enabled outside an activated production deployment/);
    expect((await db.getStripeAccount(acct)).live_key_permissions).toBeNull();
  });
});

describe('CAP-4 D7b whoami: the connection mode\'s own probe record',()=>{
  it('reports the TEST record on a TEST connection and never-probed on LIVE',async()=>{
    const db=fakeDb();
    await db.saveTestKey({account:acct,label:'D7b fixture',
      ciphertext:'test-cipher',kind:'restricted',last4:'TEST',
      permissions:{customers:'denied'}});
    await reprobeFor(db,{mode:'test',ciphertext:'test-cipher',
      probeResult:{customers:'ok'}})({account:acct,mode:'test'});
    const test=await whoami(db,'test');
    expect(test.keyPermissions).toEqual({customers:'ok'});
    expect(test.keyCheckedAt).toBe(CLOCK_ISO);
    const live=await whoami(db,'live');
    expect(live.keyPermissions).toBeNull();
    expect(live.keyCheckedAt).toBeNull();
  });
  it('reports the LIVE record on a LIVE connection and leaves TEST truth intact',async()=>{
    const db=fakeDb();
    await db.saveTestKey({account:acct,label:'D7b fixture',
      ciphertext:'test-cipher',kind:'restricted',last4:'TEST',
      permissions:{customers:'denied'}});
    await db.saveLiveKey({account:acct,ciphertext:'live-cipher',
      kind:'restricted',last4:'LIVE'});
    await reprobeFor(db,{mode:'live',ciphertext:'live-cipher',
      probeResult:{payments:'ok'}})({account:acct,mode:'live'});
    const live=await whoami(db,'live');
    expect(live.keyPermissions).toEqual({payments:'ok'});
    expect(live.keyCheckedAt).toBe(CLOCK_ISO);
    const test=await whoami(db,'test');
    expect(test.keyPermissions).toEqual({customers:'denied'});
    expect(test.keyCheckedAt).toBe(CLOCK_ISO);
  });
  it('reads a pre-existing (TEST-only) record as TEST\'s, LIVE never probed',async()=>{
    // A row written by the baseline paths only (TEST enrollment) is
    // the migration-truth case at the unit level: the stored record
    // belongs to TEST and the LIVE side starts never-probed.
    const db=fakeDb();
    await db.saveTestKey({account:acct,label:'D7b fixture',
      ciphertext:'test-cipher',kind:'restricted',last4:'TEST',
      permissions:{subscriptions:'ok'}});
    const row=await db.getStripeAccount(acct);
    expect(row.key_permissions).toEqual({subscriptions:'ok'});
    expect(row.live_key_permissions).toBeNull();
    expect(row.live_key_checked_at).toBeNull();
    expect((await whoami(db,'test')).keyPermissions)
      .toEqual({subscriptions:'ok'});
    expect((await whoami(db,'live')).keyPermissions).toBeNull();
  });
  it('normalizes stored timestamps and never crosses records (stub row)',async()=>{
    const row={id:acct,label:'Stub',live_enabled:true,is_default:false,
      test_key_kind:'restricted',test_key_last4:'TEST',
      live_key_kind:'restricted',live_key_last4:'LIVE',
      money_limit_cents:50000,
      key_permissions:null,key_checked_at:null,
      live_key_permissions:{refunds:'ok'},
      live_key_checked_at:new Date('2026-11-01T08:30:00.000Z'),
      test_connected:true,live_connected:true};
    const db={getStripeAccount:async()=>row};
    const test=await whoami(db,'test');
    expect(test.keyPermissions).toBeNull();
    expect(test.keyCheckedAt).toBeNull();
    const live=await whoami(db,'live');
    expect(live.keyPermissions).toEqual({refunds:'ok'});
    expect(live.keyCheckedAt).toBe('2026-11-01T08:30:00.000Z');
  });
});

describe('CAP-4 D7b probe tool surface',()=>{
  it('serves a LIVE connection end-to-end with a LIVE source label',async()=>{
    const probe=vi.fn(async({account:a,mode})=>({account:a,mode,
      permissions:{customers:'ok'},checkedAt:'2026-11-04T00:00:00.000Z'}));
    const conn={mode:'live',stripeAccount:acct};
    const out=parse(await handlers.stripe_check_key_permissions(
      {detail:'full'},{connection:conn,
        services:{stripePermissionReprobe:probe}}));
    expect(probe).toHaveBeenCalledWith({account:acct,mode:'live'});
    expect(out).toEqual({account:acct,mode:'live',
      permissions:{customers:'ok'},checkedAt:'2026-11-04T00:00:00.000Z',
      source:'Fresh LIVE key read-only Stripe probes'});
    const selected=parse(await handlers.stripe_check_key_permissions(
      {fields:['permissions']},{connection:conn,
        services:{stripePermissionReprobe:probe}}));
    expect(selected).toEqual({permissions:{customers:'ok'}});
  });
  it('refuses a connection with no usable mode, naming both modes',async()=>{
    const out=await handlers.stripe_check_key_permissions({},
      {connection:{mode:'bogus',stripeAccount:acct},
        services:{stripePermissionReprobe:async()=>({})}});
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toBe(
      'Only a configured TEST or LIVE account with server-side key access may be checked');
  });
  it('keeps the whoami description at baseline and converts the probe description',()=>{
    expect(tools.find(t=>t.name==='stripe_whoami').description)
      .toBe('Read selected Stripe account, profile, masked key, API version and limit.');
    expect(tools.find(t=>t.name==='stripe_check_key_permissions').description)
      .toBe('Recheck TEST or LIVE key read permissions without revealing it.');
  });
});
