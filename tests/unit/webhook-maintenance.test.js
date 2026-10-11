import {describe,it,expect,vi} from 'vitest';
import {makeWebhookMaintenance,tools,handlers} from '../../src/tools/webhook-maintenance.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='we_UPDATEFAKE',secret='sensitive_path_fake_123';
const url='https://hooks.public-domain.org/path/'+secret;
const otherUrl='https://updated.public-domain.org/webhook';
const parse=r=>JSON.parse(r.content[0].text);
function fixture({stale=false,uncertain=false,owned=false,app=null,connect=false}={}){
  let state={id,object:'webhook_endpoint',livemode:false,created:1695680197,
    status:'enabled',enabled_events:['invoice.paid','customer.updated'],
    url,application:app,connect,description:'old description',
    api_version:null,metadata:owned?{agreementId:'app-owned'}:{}};
  let calls=0;
  const clone=()=>({...state,enabled_events:[...state.enabled_events]});
  const missing=()=>Object.assign(new Error('Not found'),{code:'resource_missing',statusCode:404});
  const sdk={webhookEndpoints:{
    retrieve:vi.fn(async()=>{
      calls++;
      if(stale&&calls===2)return {...clone(),description:'concurrently updated'};
      if(!state)throw missing();
      return clone();
    }),
    update:vi.fn(async(_id,values)=>{if(!uncertain)state={...state,...values};return clone();}),
    del:vi.fn(async()=>{if(!uncertain)state=null;return {id,object:'webhook_endpoint',deleted:true};})
  }};
  const db=createFakeDb(),ctx={db,connectionId:'webhook-maintenance',
    connection:{stripeAccount:'acct_WEBHOOKFAKE',mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>sdk,
      webhookDnsLookup:async()=>[{address:'8.8.8.8',family:4}]}};
  return {ctx,db,sdk,update:a=>makeWebhookMaintenance('update').handler(a,ctx),
    remove:a=>makeWebhookMaintenance('delete').handler(a,ctx)};
}
const basic={endpointId:id,requestKey:'maintain-request'};
describe('G-4e guarded native webhook maintenance',()=>{
  it('registers two guarded tools and prevents indirect read-only invocation',async()=>{
    expect(tools.map(x=>x.name)).toEqual(['webhook_update','webhook_delete']);
    for(const t of tools){
      expect(t.writeContract).toBe('defineWrite-v1');
      expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
    }
    const f=fixture();
    for(const t of tools){
      const refused=await dispatchReadOnlyTool({registry,name:t.name,
        connection:{...f.ctx.connection,profile:'read_only'},db:f.db,
        services:f.ctx.services,args:{...basic,confirm:true}});
      expect(refused.isError).toBe(true);
    }
  });
  it('previews only origin; confirmed update preserves event subscriptions',async()=>{
    const f=fixture(),args={...basic,url:otherUrl,description:'new description'};
    const preview=parse(await f.update({...args,dryRun:true}));
    expect(preview.preview).toContain('hooks.public-domain.org');
    expect(JSON.stringify(preview)).not.toContain(secret);
    expect(parse(await f.update(args)).needsConfirmation).toBe(true);
    expect(f.sdk.webhookEndpoints.update).not.toHaveBeenCalled();
    expect(parse(await f.update({...args,confirm:true}))).toMatchObject({done:true,confirmed:true});
    expect(f.sdk.webhookEndpoints.update).toHaveBeenCalledWith(id,
      {url:otherUrl,description:'new description'},
      {idempotencyKey:expect.stringMatching(/^rmcp_webhook_update_/)}); 
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toContain(secret);
  });
  it('native delete requires provider 404 tombstone; never returns old secret',async()=>{
    const f=fixture();
    expect(parse(await f.remove({...basic,dryRun:true})).preview).toContain('Delete');
    expect(parse(await f.remove(basic)).needsConfirmation).toBe(true);
    expect(f.sdk.webhookEndpoints.del).not.toHaveBeenCalled();
    expect(parse(await f.remove({...basic,confirm:true}))).toMatchObject({done:true,confirmed:true});
    expect(f.sdk.webhookEndpoints.del).toHaveBeenCalledWith(id,{},
      {idempotencyKey:expect.stringMatching(/^rmcp_webhook_delete_/)});
    const never=fixture({uncertain:true});
    expect(parse(await never.remove({...basic,confirm:true})).confirmed).toBe(false);
    expect(never.sdk.webhookEndpoints.del).toHaveBeenCalledTimes(1);
  });
  it('stale plan, app/Connect ownership and LIVE deny all writes',async()=>{
    const stale=fixture({stale:true});
    expect(parse(await stale.update({...basic,description:'new',confirm:true})).confirmed).toBe(false);
    expect(stale.sdk.webhookEndpoints.update).not.toHaveBeenCalled();
    for(const options of [{owned:true},{app:'ca_APPFAKE'},{connect:true}]){
      const f=fixture(options);
      if(options.owned){
        const response=await f.update({...basic,description:'new',confirm:true});
        expect(response.isError).toBe(true);
      }else{
        await expect(f.update({...basic,description:'new',confirm:true})).rejects.toThrow();
      }
      expect(f.sdk.webhookEndpoints.update).not.toHaveBeenCalled();
    }
    const live=await handlers.webhook_delete({...basic,confirm:true},{
      ...stale.ctx,connection:{...stale.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);
  });
  it('rejects unsafe destination, unknown fields, empty update and delete extras',async()=>{
    const f=fixture();
    for(const a of [{...basic},{...basic,url:'http://127.0.0.1/path'},
      {...basic,url:'https://example.com/path?key=abc'},
      {...basic,description:'bad\nvalue'}, {...basic,extra:'unexpected'}]){
      await expect(f.update(a)).rejects.toThrow();
    }
    await expect(f.remove({...basic,url:otherUrl})).rejects.toThrow();
    expect(f.sdk.webhookEndpoints.update).not.toHaveBeenCalled();
    expect(f.sdk.webhookEndpoints.del).not.toHaveBeenCalled();
  });
});
