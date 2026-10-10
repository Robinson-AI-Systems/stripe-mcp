import {describe,expect,it} from 'vitest';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createPermissionReprobe} from '../../src/keys.js';
import {handlers} from '../../src/tools/server.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const parse=r=>JSON.parse(r.content[0].text);
describe('B-8b1 independently verified TEST-only permission probes',()=>{
  it('lazily probes server-owned key and saves only safe permissions, not credentials',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_test_owner',label:'Fixture'}]});
    await db.saveTestKey({account:'acct_test_owner',label:'Fixture',ciphertext:'test-fixture-cipher',
      kind:'restricted',last4:'FAKE',permissions:{customers:'denied'}});
    const secret=['rk','test','NOTAREALKEY12345'].join('_');
    let loaded=0,checked=0;
    const probe=createPermissionReprobe({
      db,
      keyStoreFactory:()=>({loadKey:async ({account,mode})=>{
        expect(account).toBe('acct_test_owner');expect(mode).toBe('test');loaded++;return secret;
      }}),
      makeClient:({key,mode})=>{expect(key).toBe(secret);expect(mode).toBe('test');return {fake:true};},
      probe:async client=>{expect(client.fake).toBe(true);checked++;
        return {customers:'ok',refunds:'denied'};}
    });
    expect(loaded).toBe(0); // Decryption is deferred until authenticated tool call.
    const result=await probe({account:'acct_test_owner',mode:'test'});
    expect(result.permissions).toEqual({customers:'ok',refunds:'denied'});
    expect(loaded).toBe(1);expect(checked).toBe(1);
    expect((await db.getStripeAccount('acct_test_owner')).key_permissions).toEqual(result.permissions);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
  it('refuses LIVE, unknown accounts and malformed permission results',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_test_owner',label:'Fixture'}]});
    const probe=createPermissionReprobe({db,keyStoreFactory:()=>{
      throw Error('Must not load credentials for LIVE');
    }});
    await expect(probe({account:'acct_test_owner',mode:'live'})).rejects.toThrow(/TEST/);
    await expect(probe({account:'other',mode:'test'})).rejects.toThrow();
    const malformed=createPermissionReprobe({db,keyStoreFactory:()=>({
      loadKey:async()=>['rk','test','FAKE'].join('_')}),
      makeClient:()=>({}),probe:async()=>({customers:'unverified'})});
    await expect(malformed({account:'acct_test_owner',mode:'test'})).rejects.toThrow();
  });
  it('denies the MCP permission tool unless server probe and selected TEST account exist',async()=>{
    const db=createFakeDb({accounts:[{id:'acct_A',label:'A'}]});
    const conn={stripeAccount:'acct_A',mode:'test',profile:'read_only'};
    expect((await handlers.stripe_check_key_permissions({},{
      db,connection:conn})).isError).toBe(true);
    expect((await handlers.stripe_check_key_permissions({},{
      db,connection:{...conn,mode:'live'},permissionProbe:async()=>({})})).isError).toBe(true);
    let called=0;
    const result=await dispatchReadOnlyTool({registry,name:'stripe_check_key_permissions',
      args:{},connection:conn,db,permissionProbe:async ({account,mode})=>{
        expect(account).toBe('acct_A');expect(mode).toBe('test');called++;
        return {account,mode,checkedAt:'2026-10-10T00:00:00Z',
          permissions:{customers:'ok',refunds:'denied'}};
      }});
    expect(called).toBe(1);
    expect(parse(result).permissions).toEqual({customers:'ok',refunds:'denied'});
  });
});
