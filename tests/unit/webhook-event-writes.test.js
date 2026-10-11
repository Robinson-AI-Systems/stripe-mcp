import {describe,it,expect,vi} from 'vitest';
import {makeWebhookEventChange,tools,handlers} from '../../src/tools/webhook-event-writes.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const id='we_FAKE1234',secret='PRIVATE_WEBHOOK_SECRET_SENTINEL';
const parse=r=>JSON.parse(r.content[0].text);
const initial=['customer.updated','invoice.paid'];
function fixture({events=initial,owned=false,stale=false,uncertain=false,
  app=null,connect=false}={}){
  let state={id,object:'webhook_endpoint',livemode:false,created:1695680197,
    status:'enabled',enabled_events:[...events],application:app,connect,
    url:'https://app.example.com/path?secret='+secret,description:'private',
    api_version:null,metadata:owned?{agreementId:'app-owned'}:{}};
  let calls=0;
  const s={webhookEndpoints:{
    retrieve:vi.fn(async()=>{
      calls++;
      if(stale&&calls===2)return {...state,enabled_events:[...state.enabled_events,'charge.failed']};
      return {...state,enabled_events:[...state.enabled_events]};}),
    update:vi.fn(async(_id,args)=>{
      if(!uncertain)state={...state,enabled_events:[...args.enabled_events]};
      return {...state};
    })}};
  const db=createFakeDb(),ctx={db,connectionId:'webhook-changes',
    connection:{mode:'test',stripeAccount:'acct_FAKE1234',profile:'everyday'},
    services:{stripeForConnection:async()=>s}};
  return {ctx,db,s,add:a=>makeWebhookEventChange('add').handler(a,ctx),
    remove:a=>makeWebhookEventChange('remove').handler(a,ctx)};
}
const args={endpointId:id,events:['charge.succeeded'],requestKey:'change-once'};
describe('G-4c TEST webhook event subscription changes',()=>{
  it('registers distinct guarded write contracts with no direct read-only exposure',()=>{
    expect(tools.map(x=>x.name)).toEqual(['webhook_add_events','webhook_remove_events']);
    for(const t of tools){
      expect(t.writes).toBe(true);
      expect(t.writeContract).toBe('defineWrite-v1');
      expect(t.profiles).toEqual(['everyday','full']);
      expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
    }
  });
  it('preview/no confirm never writes; confirmed add preserves unrelated events',async()=>{
    const f=fixture();
    const preview=parse(await f.add({...args,dryRun:true}));
    expect(preview.preview).toContain('charge.succeeded');
    expect(JSON.stringify(preview)).not.toContain(secret);
    expect(parse(await f.add(args)).needsConfirmation).toBe(true);
    expect(f.s.webhookEndpoints.update).not.toHaveBeenCalled();
    expect(parse(await f.add({...args,confirm:true}))).toMatchObject({
      done:true,confirmed:true});
    expect(f.s.webhookEndpoints.update).toHaveBeenCalledWith(id,{
      enabled_events:['charge.succeeded','customer.updated','invoice.paid']
    },{idempotencyKey:expect.stringMatching(/^rmcp_webhook_add_events_/)});
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toContain(secret);
  });
  it('remove subtracts only named events and retains unrelated subscriptions',async()=>{
    const f=fixture(),a={endpointId:id,events:['customer.updated'],requestKey:'remove'};
    expect(parse(await f.remove({...a,dryRun:true})).preview)
      .toContain('REMOVE');
    expect(parse(await f.remove({...a,confirm:true}))).toMatchObject({
      done:true,confirmed:true});
    expect(f.s.webhookEndpoints.update).toHaveBeenCalledWith(id,{
      enabled_events:['invoice.paid']
    },{idempotencyKey:expect.any(String)});
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toContain(secret);
  });
  it('already-present add and absent removal do no Stripe update',async()=>{
    const f=fixture();
    expect(parse(await f.add({endpointId:id,events:['invoice.paid'],confirm:true})))
      .toMatchObject({done:true,confirmed:true});
    expect(parse(await f.remove({endpointId:id,events:['charge.refunded'],confirm:true})))
      .toMatchObject({done:true,confirmed:true});
    expect(f.s.webhookEndpoints.update).not.toHaveBeenCalled();
  });
  it('wildcard, removing final, app marker, Connect and application-owned fail closed',async()=>{
    for(const [params,method,ev] of [
      [{events:['*']},'add',['*']],
      [{events:['invoice.paid']},'remove',['invoice.paid']],
      [{owned:true},'add',initial],
      [{app:'ca_FAKE1234'},'add',initial],
      [{connect:true},'add',initial]
    ]){
      const f=fixture({...params,events:ev});
      const a={...args,events:params.events??args.events,confirm:true};
      if(params.owned){
        expect(parse(await f[method](a)).done).toBe(false);
      }else{
        await expect(f[method](a)).rejects.toThrow();
      }
      expect(f.s.webhookEndpoints.update).not.toHaveBeenCalled();
    }
  });
  it('rejects malformed IDs, values, duplicates and unknown private arguments',async()=>{
    const f=fixture();
    for(const bad of [{endpointId:'we_BAD'}, {events:['*']},
      {events:['invoice.paid','invoice.paid']}, {events:['not-an-event']},
      {privateSecret:secret}]){
      await expect(f.add({...args,...bad,confirm:true})).rejects.toThrow();
    }
    expect(f.s.webhookEndpoints.update).not.toHaveBeenCalled();
  });
  it('stale preflight and missing provider readback cannot falsely confirm',async()=>{
    const stale=fixture({stale:true});
    expect(parse(await stale.add({...args,confirm:true})).confirmed).toBe(false);
    expect(stale.s.webhookEndpoints.update).not.toHaveBeenCalled();
    const uncertain=fixture({uncertain:true});
    expect(parse(await uncertain.add({...args,confirm:true}))).toMatchObject({
      done:false,confirmed:false});
    expect(uncertain.s.webhookEndpoints.update).toHaveBeenCalledTimes(1);
  });
  it('read-only and LIVE block mutations, including indirect invocation',async()=>{
    const f=fixture();
    for(const t of tools){
      const no=await dispatchReadOnlyTool({registry,name:t.name,args:{...args,confirm:true},
        connection:{...f.ctx.connection,profile:'read_only'},db:f.db,
        services:f.ctx.services});
      expect(no.isError).toBe(true);
      const live=await handlers[t.name]({...args,confirm:true},{
        ...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
      expect(live.isError).toBe(true);
    }
    expect(f.s.webhookEndpoints.update).not.toHaveBeenCalled();
  });
});
