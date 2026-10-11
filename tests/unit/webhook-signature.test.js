import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {makeStripeClient} from '../../src/stripe/client.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {createWebhookSignatureStore,createOwnerWebhookProvisioner} from '../../src/webhooks/signature-store.js';
import {handlers,tools} from '../../src/tools/webhook-signature.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const account='acct_WEBHOOKSIG',endpoint='we_WEBHOOKSIG';
const key=['sk','test','FAKESIGN'].join('_'), secret='whsec_'+'X'.repeat(40);
const sdk=makeStripeClient({key,mode:'test'});
const parse=x=>JSON.parse(x.content[0].text);
const payload=JSON.stringify({id:'evt_SAFEVERIFIED',object:'event',livemode:false,type:'invoice.paid'});
const signature=(text=payload,s=secret,t=Math.floor(Date.now()/1000))=>
  sdk.webhooks.generateTestHeaderString({payload:text,secret:s,timestamp:t});
function fixture(){
  const db=createFakeDb({accounts:[{id:account}]});
  // Fake TEST connectivity intentionally derives from encrypted key persistence.
  db.saveTestKey({account,label:'Fixture',ciphertext:'test-ciphertext',kind:'restricted',last4:'FAKE'});
  const store=createWebhookSignatureStore({db,encryptionKey:randomBytes(32)});
  const keyStore={loadKey:async({account:a,mode})=>{
    expect(a).toBe(account);expect(mode).toBe('test');return key;}};
  const provider={webhookEndpoints:{retrieve:async id=>({id,object:'webhook_endpoint',
    livemode:false,application:null,connect:false})},webhooks:sdk.webhooks};
  const makeClient=()=>provider;
  const provision=createOwnerWebhookProvisioner({db,keyStore,makeClient,store});
  const ctx={db,connection:{stripeAccount:account,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>provider,webhookSignatureStore:store}};
  return {db,store,provision,ctx,run:(a)=>handlers.webhook_check_signature(a,ctx)};
}
describe('G-4e2 owner-provisioned TEST webhook HMAC',()=>{
  it('performs real official-SDK cryptographic check with private storage',async()=>{
    const f=fixture();
    await f.provision({account,endpoint,secret});
    const args={endpointId:endpoint,payload,signature:signature()};
    expect(parse(await f.run(args))).toMatchObject({verified:true,mode:'test',
      endpointId:endpoint,eventId:'evt_SAFEVERIFIED',eventType:'invoice.paid'});
    expect(JSON.stringify(await f.run(args))).not.toContain(secret);
    expect((await f.db.getWebhookSigningSecret({account,endpoint})).ciphertext).toMatch(/^v1\./);
    expect(JSON.stringify(await f.db.getWebhookSigningSecret({account,endpoint}))).not.toContain(secret);
  });
  it('rejects absent, false, stale, wrong account or wrong endpoint credentials',async()=>{
    const f=fixture();
    const args={endpointId:endpoint,payload,signature:signature()};
    expect((await f.run(args)).isError).toBe(true);
    await f.provision({account,endpoint,secret});
    for(const a of [
      {...args,signature:signature(payload,'whsec_'+'Y'.repeat(40))},
      {...args,signature:signature(payload,secret,Math.floor(Date.now()/1000)-3600)},
      {...args,endpointId:'we_OTHER'}, {...args,payload:payload+'X'}]){
      const v=await f.run(a);expect(v.isError).toBe(true);
      expect(JSON.stringify(v)).not.toContain(payload);
      expect(JSON.stringify(v)).not.toContain(a.signature);
    }
    const other={...f.ctx,connection:{...f.ctx.connection,stripeAccount:'acct_FOREIGN'}};
    expect((await handlers.webhook_check_signature(args,other)).isError).toBe(true);
  });
  it('fails closed on LIVE, Connect, missing fields, indirect unauthorized dispatch',async()=>{
    const f=fixture();await f.provision({account,endpoint,secret});
    const args={endpointId:endpoint,payload,signature:signature()};
    expect((await handlers.webhook_check_signature(args,{...f.ctx,
      connection:{...f.ctx.connection,mode:'live'}})).isError).toBe(true);
    expect((await f.run({...args,signature:'t=1,v1=invalid'})).isError).toBe(true);
    expect((await f.run({...args,extra:'unexpected'})).isError).toBe(true);
    for(const e of [{...JSON.parse(payload),account:'acct_CONNECT'},
      {...JSON.parse(payload),livemode:true}]){
      const p=JSON.stringify(e);
      expect((await f.run({...args,payload:p,signature:signature(p)})).isError).toBe(true);
    }
    const denied=await dispatchReadOnlyTool({registry,name:'webhook_check_signature',
      args,connection:{...f.ctx.connection,profile:'read_only'},
      services:f.ctx.services,db:f.db});
    expect(denied.isError).toBe(true);
    expect(tools[0].writes).toBe(false);
  });
  it('validates the provider endpoint and account before any owner storage',async()=>{
    const f=fixture();
    await expect(f.provision({account,endpoint:'we_INVALID',secret:''})).rejects.toThrow();
    const restricted=createOwnerWebhookProvisioner({db:f.db,
      keyStore:{loadKey:async()=>key},makeClient:()=>({webhookEndpoints:{
        retrieve:async()=>({id:endpoint,object:'webhook_endpoint',livemode:true})}}),
      store:f.store});
    await expect(restricted({account,endpoint,secret})).rejects.toThrow();
    expect(await f.store.load({account,endpoint})).toBeNull();
  });
});
