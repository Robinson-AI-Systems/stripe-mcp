import {describe,it,expect,vi} from 'vitest';
import {webhookSafe,tools,handlers} from '../../src/tools/webhooks-read.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='we_FAKE1234',secret='PRIVATE_WEBHOOK_SIGNING_SECRET',url=
  'https://hooks.example.com/private-token/'+secret+'?token='+secret;
const record={id,object:'webhook_endpoint',created:1695680197,livemode:false,
  url,secret,status:'enabled',description:secret,metadata:{token:secret},
  enabled_events:['invoice.paid','customer.updated'],api_version:null};
const parse=r=>JSON.parse(r.content[0].text);
function fixture({value=record,malformed=false}={}){
  const s={webhookEndpoints:{
    list:vi.fn(async()=>malformed?{data:[value]}:{data:[value],has_more:false}),
    retrieve:vi.fn(async()=>value)}};
  const ctx={connection:{mode:'test',profile:'read_only',stripeAccount:'acct_FAKE1234'},
    services:{stripeForConnection:async()=>s}};
  return {s,ctx,call:(name,a={})=>handlers[name](a,ctx)};
}
describe('G-4b TEST webhook endpoint safe reads',()=>{
  it('registers two read-only endpoint tools for all profiles',()=>{
    expect(tools.map(t=>t.name)).toEqual(['webhook_list','webhook_get']);
    for(const t of tools){
      expect(t).toMatchObject({writes:false,profiles:['read_only','everyday','full']});
      expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
    }
  });
  it('never projects secret, raw URL path or query, metadata or description',()=>{
    const full=webhookSafe(record,{detail:'full'});
    expect(full).toMatchObject({id,status:'enabled',destinationOrigin:'https://hooks.example.com',
      enabledEvents:['invoice.paid','customer.updated']});
    expect(JSON.stringify(full)).not.toMatch(/PRIVATE|token|metadata|description|secret/);
    expect(webhookSafe(record)).not.toHaveProperty('enabledEvents');
    expect(webhookSafe({...record,url:'https://user:pass@hooks.example.com/path'}).destinationOrigin)
      .toBe(null);
    expect(()=>webhookSafe({...record,livemode:true})).toThrow();
    expect(()=>webhookSafe({...record,enabled_events:['private'] })).toThrow();
  });
  it('list uses bounded native endpoint paging and safe summary',async()=>{
    const f=fixture();
    const v=parse(await f.call('webhook_list',{limit:2,detail:'full'}));
    expect(v.data[0]).toHaveProperty('enabledEventCount',2);
    expect(f.s.webhookEndpoints.list).toHaveBeenCalledWith({limit:2});
    expect(JSON.stringify(v)).not.toContain(secret);
    for(const bad of [{limit:50},{starting_after:'we_BAD'},
      {token:secret},{fields:['secret']},{detail:'raw'}])
      expect((await f.call('webhook_list',bad)).isError).toBe(true);
  });
  it('get checks exact identity and full event projection, rejecting unknown params',async()=>{
    const f=fixture();
    expect(parse(await f.call('webhook_get',{endpointId:id,detail:'full'})))
      .toMatchObject({id,enabledEventCount:2});
    expect(f.s.webhookEndpoints.retrieve).toHaveBeenCalledWith(id);
    expect((await f.call('webhook_get',{endpointId:'we_BAD'})).isError).toBe(true);
    expect((await f.call('webhook_get',{endpointId:id,secret})).isError).toBe(true);
    const wrong=fixture({value:{...record,id:'we_OTHER'}});
    expect((await wrong.call('webhook_get',{endpointId:id})).isError).toBe(true);
  });
  it('truncation is explicit for verbose endpoint event lists',()=>{
    const events=Array.from({length:45},(_,i)=>'invoice.created'+i);
    // Only actual Stripe-like dot event types should pass the allowlist.
    const safe=webhookSafe({...record,enabled_events:events},{detail:'full'});
    expect(safe.enabledEvents).toHaveLength(30);
    expect(safe.moreEnabledEvents).toBe(true);
    expect(safe.enabledEventCount).toBe(45);
    const list=webhookSafe({...record,enabled_events:events},{detail:'full',list:true});
    expect(list.enabledEvents).toHaveLength(8);
  });
  it('indirect read-only profile is safe, LIVE is refused and malformed pages fail',async()=>{
    const f=fixture();
    const via=await dispatchReadOnlyTool({registry,name:'webhook_get',
      args:{endpointId:id},db:{},connection:f.ctx.connection,services:f.ctx.services});
    expect(via.isError).toBeUndefined();
    expect(JSON.stringify(via)).not.toContain(secret);
    const live=await handlers.webhook_get({endpointId:id},{...f.ctx,
      connection:{...f.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);
    const broken=fixture({malformed:true});
    expect((await broken.call('webhook_list')).isError).toBe(true);
  });
});
