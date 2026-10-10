import {describe,expect,it} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createPermissionReprobe} from '../../src/keys.js';
import {handlers} from '../../src/tools/server.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const parse=r=>JSON.parse(r.content[0].text);
describe('B-8b1 independently verified TEST-only permission probes',()=>{
  it('lazily probes server-owned key and saves only safe permissions, not credentials',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_testowner',label:'Fixture'}]});
    await db.saveTestKey({account:'acct_testowner',label:'Fixture',ciphertext:'test-fixture-cipher',
      kind:'restricted',last4:'FAKE',permissions:{customers:'denied'}});
    const secret=['rk','test','NOTAREALKEY12345'].join('_');
    let loaded=0,checked=0;
    const probe=createPermissionReprobe({
      db,
      keyStoreFactory:()=>({loadKeySnapshot:async ({account,mode})=>{
        expect(account).toBe('acct_testowner');expect(mode).toBe('test');loaded++;
        return {key:secret,expectedCiphertext:'test-fixture-cipher'};
      }}),
      makeClient:({key,mode})=>{expect(key).toBe(secret);expect(mode).toBe('test');return {fake:true};},
      probe:async client=>{expect(client.fake).toBe(true);checked++;
        return {customers:'ok',refunds:'denied'};}
    });
    expect(loaded).toBe(0); // Decryption is deferred until authenticated tool call.
    const result=await probe({account:'acct_testowner',mode:'test'});
    expect(result.permissions).toEqual({customers:'ok',refunds:'denied'});
    expect(loaded).toBe(1);expect(checked).toBe(1);
    expect((await db.getStripeAccount('acct_testowner')).key_permissions).toEqual(result.permissions);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
  it('refuses LIVE, unknown accounts and malformed permission results',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_testowner',label:'Fixture'}]});
    const probe=createPermissionReprobe({db,keyStoreFactory:()=>{
      throw Error('Must not load credentials for LIVE');
    }});
    await expect(probe({account:'acct_testowner',mode:'live'})).rejects.toThrow(/TEST/);
    await expect(probe({account:'other',mode:'test'})).rejects.toThrow();
    const malformed=createPermissionReprobe({db,keyStoreFactory:()=>({
      loadKeySnapshot:async()=>({key:['rk','test','FAKE'].join('_'),
        expectedCiphertext:'fixture-cipher'})}),
      makeClient:()=>({}),probe:async()=>({customers:'unverified'})});
    await expect(malformed({account:'acct_testowner',mode:'test'})).rejects.toThrow();
  });
  it('fails closed when the owner rotates the key during the nine read probes',async()=>{
    const account='acct_rotation';
    const db=createFakeDb({accounts:[{id:account,label:'Fixture'}]});
    await db.saveTestKey({account,label:'Fixture',ciphertext:'original-cipher',
      kind:'restricted',last4:'0001',permissions:{customers:'denied'}});
    const check=createPermissionReprobe({db,
      keyStoreFactory:()=>({loadKeySnapshot:async()=>({
        key:['rk','test','FAKE12345'].join('_'),expectedCiphertext:'original-cipher'})}),
      makeClient:()=>({}),
      probe:async()=>{
        await db.saveTestKey({account,label:'Fixture',ciphertext:'rotated-cipher',
          kind:'restricted',last4:'0002',permissions:{customers:'denied'}});
        return {customers:'ok'};
      }
    });
    await expect(check({account,mode:'test'})).rejects.toThrow(/could not be updated/);
    expect((await db.getStripeAccount(account)).key_permissions).toEqual({customers:'denied'});
  });
  it('denies the MCP permission tool unless server probe and selected TEST account exist',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_A',label:'A'}]});
    const conn={stripeAccount:'acct_A',mode:'test',profile:'read_only'};
    expect((await handlers.stripe_check_key_permissions({},{
      db,connection:conn})).isError).toBe(true);
    expect((await handlers.stripe_check_key_permissions({},{
      db,connection:{...conn,mode:'live'},services:{stripePermissionReprobe:async()=>({})}})).isError).toBe(true);
    let called=0;
    const result=await dispatchReadOnlyTool({registry,name:'stripe_check_key_permissions',
      args:{},connection:conn,db,services:{stripePermissionReprobe:async ({account,mode})=>{
        expect(account).toBe('acct_A');expect(mode).toBe('test');called++;
        return {account,mode,checkedAt:'2026-10-10T00:00:00Z',
          permissions:{customers:'ok',refunds:'denied'}};
      }}});
    expect(called).toBe(1);
    expect(parse(result).permissions).toEqual({customers:'ok',refunds:'denied'});
    const full=await handlers.stripe_check_key_permissions({detail:'full'},{
      connection:conn,services:{stripePermissionReprobe:async ({account,mode})=>({
        account,mode,checkedAt:'2026-10-10T00:00:00Z',
        permissions:{customers:'ok'}})}});
    expect(parse(full).source).toMatch(/Fresh TEST/);
    const selected=await handlers.stripe_check_key_permissions({fields:['permissions']},{
      connection:conn,services:{stripePermissionReprobe:async ({account,mode})=>({
        account,mode,checkedAt:'2026-10-10T00:00:00Z',
        permissions:{customers:'ok'}})}});
    expect(parse(selected)).toEqual({permissions:{customers:'ok'}});
    expect((await handlers.stripe_check_key_permissions({fields:['forbidden']},{
      connection:conn,services:{stripePermissionReprobe:async()=>({})}})).isError).toBe(true);
  });
});
