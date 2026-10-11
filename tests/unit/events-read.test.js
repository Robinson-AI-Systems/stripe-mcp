import {describe,it,expect,vi} from 'vitest';
import {eventSafe,tools,handlers} from '../../src/tools/events-read.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const id='evt_FAKE1234',privateText='PRIVATE_CARD_EMAIL_SENTINEL';
const source={id,object:'event',type:'charge.succeeded',created:1695680197,
  livemode:false,api_version:'2025-10-29.clover',pending_webhooks:1,
  data:{object:{id:'ch_FAKE1234',object:'charge',billing_details:{email:privateText},
    payment_method_details:{card:{number:privateText}}}},
  request:{id:'req_FAKE1234',idempotency_key:privateText},
  account:'acct_FAKE1234'};
const parse=r=>JSON.parse(r.content[0].text);
function fixture({event=source,badList=false}={}){
  const s={events:{list:vi.fn(async()=>badList?{data:[event]}:{
    object:'list',data:[event],has_more:false}),
    retrieve:vi.fn(async()=>event)}};
  const ctx={connection:{mode:'test',profile:'read_only',stripeAccount:'acct_FAKE1234'},
    services:{stripeForConnection:async()=>s}};
  return {s,ctx,call:(name,a={})=>handlers[name](a,ctx)};
}
describe('G-4a TEST Event summaries and undelivered filters',()=>{
  it('registers three safe reads visible to every profile',()=>{
    expect(tools.map(x=>x.name)).toEqual([
      'event_list','event_get','event_list_undelivered']);
    for(const t of tools){
      expect(t).toMatchObject({writes:false,profiles:['read_only','everyday','full']});
      expect(registry.tools.filter(x=>x.name===t.name)).toHaveLength(1);
    }
  });
  it('excludes raw customer, card, request and secret data',()=>{
    const full=eventSafe(source,{detail:'full'});
    expect(full).toMatchObject({id,type:'charge.succeeded',objectId:'ch_FAKE1234',
      pendingWebhooks:1});
    expect(JSON.stringify(full)).not.toMatch(/PRIVATE|billing_details|payment_method|data|account/);
    expect(eventSafe(source)).not.toHaveProperty('objectId');
    expect(eventSafe(source,{detail:'full',select:['type','objectId']}))
      .toEqual({id,type:'charge.succeeded',objectId:'ch_FAKE1234'});
    expect(()=>eventSafe({...source,livemode:true})).toThrow();
    expect(()=>eventSafe({...source,type:'PRIVATE'})).toThrow();
  });
  it('list validates paging, filters and data privacy',async()=>{
    const f=fixture();
    const result=parse(await f.call('event_list',{limit:2,type:'charge.succeeded',
      createdGte:1695680000,detail:'full'}));
    expect(result.data[0]).toHaveProperty('objectId','ch_FAKE1234');
    expect(f.s.events.list).toHaveBeenCalledWith({limit:2,type:'charge.succeeded',
      created:{gte:1695680000}});
    expect(JSON.stringify(result)).not.toContain(privateText);
    for(const bad of [{type:'PRIVATE'},{limit:100},
      {type:'charge.succeeded',types:['charge.failed']},
      {privateSecret:privateText},{starting_after:'bad'}])
      expect((await f.call('event_list',bad)).isError).toBe(true);
  });
  it('undelivered uses native provider filter but does not claim app receipt',async()=>{
    const f=fixture(),value=parse(await f.call('event_list_undelivered',{
      limit:1,types:['invoice.paid','charge.succeeded']}));
    expect(f.s.events.list).toHaveBeenCalledWith({limit:1,
      types:['invoice.paid','charge.succeeded'],delivery_success:false});
    expect(value.filter).toBe('Stripe delivery_success=false');
    expect(value.note).toMatch(/does not prove/);
    expect(JSON.stringify(value)).not.toContain(privateText);
  });
  it('exact GET and TEST mode refuse unsafe requests',async()=>{
    const f=fixture();
    expect(parse(await f.call('event_get',{eventId:id,detail:'full'})))
      .toMatchObject({id,type:'charge.succeeded'});
    expect(f.s.events.retrieve).toHaveBeenCalledWith(id);
    expect((await f.call('event_get',{eventId:'evt_BAD'})).isError).toBe(true);
    expect((await f.call('event_get',{eventId:id,payload:privateText})).isError).toBe(true);
    expect((await fixture({event:{...source,id:'evt_OTHER'}})
      .call('event_get',{eventId:id})).isError).toBe(true);
    const live=await handlers.event_list({},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);
  });
  it('malformed pages refuse, and indirect profile call preserves safe projection',async()=>{
    const f=fixture({badList:true});
    expect((await f.call('event_list')).isError).toBe(true);
    const call=await dispatchReadOnlyTool({registry,name:'event_get',
      args:{eventId:id},db:{},connection:f.ctx.connection,services:f.ctx.services});
    expect(call.isError).toBeUndefined();
    expect(JSON.stringify(call)).not.toContain(privateText);
  });
});
