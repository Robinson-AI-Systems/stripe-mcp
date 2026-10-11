import {describe,it,expect,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import Stripe from 'stripe';
import {verifyOriginalTestEvent,selectOriginalTestEvents,
  deliverOriginalTestEvent} from '../../src/dev/forwarder-delivery.js';
const acct='acct_FORWARDFAKE';
const secret='whsec_'+'f'.repeat(32);
const types=['customer.created','invoice.paid'];
const event=(id='evt_FAKE123',type='customer.created')=>({
  id,object:'event',created:1760000000,livemode:false,type,
  data:{object:{object:'customer',id:'cus_FAKE123',livemode:false}}});
const failRead={events:{list:async()=>{throw Error('must not list');},
  retrieve:async()=>{throw Error('must not retrieve');}}};
function fakeSender(statusCode=204){
  const requests=[];
  function requestHttps(options,onResponse){
    const req=new EventEmitter();
    req.destroy=error=>{queueMicrotask(()=>req.emit('error',error));};
    req.end=body=>{
      requests.push({options,body});
      const res=new EventEmitter();res.statusCode=statusCode;
      queueMicrotask(()=>{onResponse(res);res.emit('data',Buffer.from('OK'));
        res.emit('end');});
    };
    return req;
  }
  return {requestHttps,requests};
}
const lookup=async()=>[{address:'8.8.8.8',family:4}];
describe('V-4c1 original TEST Event selection',()=>{
  it('rejects LIVE, foreign-account, unrequested or fabricated events',()=>{
    for(const candidate of [
      {...event(),livemode:true},
      {...event(),account:'acct_OTHERFAKE'},
      event('evt_FAKE123','charge.refunded'),
      {...event(),data:{object:{livemode:true}}},
      {...event(),object:'source'},
      {...event(),created:0}
    ])expect(()=>verifyOriginalTestEvent(candidate,{
      accountId:acct,types})).toThrow();
    expect(verifyOriginalTestEvent(event(),{accountId:acct,types}).id)
      .toBe('evt_FAKE123');
  });
  it('independently retrieves exact IDs, never fabricating Stripe events',async()=>{
    const one=event('evt_TESTA'),two=event('evt_TESTB','invoice.paid');
    const retrieve=vi.fn(async id=>id===one.id?one:two);
    const result=await selectOriginalTestEvents({
      stripe:{events:{list:failRead.events.list,retrieve}},
      accountId:acct,forwarderTypes:types,
      eventIds:[one.id,two.id]});
    expect(result).toMatchObject({selection:'ids',hasMore:false,nextCursor:null});
    expect(result.events).toEqual([one,two]);
    expect(retrieve).toHaveBeenCalledTimes(2);
    await expect(selectOriginalTestEvents({stripe:{events:{
      list:failRead.events.list,retrieve:async()=>({...one,livemode:true})}},
      accountId:acct,forwarderTypes:types,eventIds:[one.id]})).rejects.toThrow();
  });
  it('uses real Stripe bounded list filter, independently checks each retrieved Event and exposes cursor',async()=>{
    const one=event('evt_TESTA'),two=event('evt_TESTB','invoice.paid');
    const list=vi.fn(async()=>({has_more:true,data:[one,two]}));
    const retrieve=vi.fn(async id=>id===one.id?one:two);
    const selected=await selectOriginalTestEvents({stripe:{events:{list,retrieve}},
      accountId:acct,forwarderTypes:types,since:1759900000,now:1760000000});
    expect(list).toHaveBeenCalledWith({created:{gte:1759900000},
      types,limit:5});
    expect(retrieve).toHaveBeenCalledTimes(2);
    expect(selected).toMatchObject({hasMore:true,nextCursor:two.id,selection:'since'});
    const mismatched=await selectOriginalTestEvents({
      stripe:{events:{list:async()=>({has_more:false,data:[one]}),
        retrieve:async()=>({...one,type:'invoice.paid'})}},
      accountId:acct,forwarderTypes:types,since:1759900000,now:1760000000
    }).then(()=>false,()=>true);
    expect(mismatched).toBe(true);
  });
  it('refuses unbounded/unsupported selectors and future timestamps',async()=>{
    for(const selection of [
      {eventIds:[]},{eventIds:['evt_FAKE123','evt_FAKE123']},
      {eventIds:['evt_FAKE123'],since:1759900000},
      {since:1760000001},{since:1750000000},
      {since:1759900000,types:['charge.refunded']},
      {since:1759900000,startingAfter:'wrong'}
    ])await expect(selectOriginalTestEvents({stripe:failRead,accountId:acct,
      forwarderTypes:types,now:1760000000,...selection})).rejects.toThrow();
  });
});
describe('V-4c1 DNS-revalidated pinned TLS sender',()=>{
  it('signs exact transmitted bytes with Stripe SDK equivalence and a pinned globally public IP',async()=>{
    const sender=fakeSender();
    const e=event();
    const result=await deliverOriginalTestEvent({
      url:'https://hooks.example.org/stripe/events',event:e,accountId:acct,
      types,secret,lookup,requestHttps:sender.requestHttps});
    expect(result).toMatchObject({eventId:e.id,statusCode:204,accepted:true});
    expect(result.note).toMatch(/not confirmed/);
    expect(sender.requests).toHaveLength(1);
    const {options,body}=sender.requests[0];
    expect(options).toMatchObject({protocol:'https:',hostname:'hooks.example.org',
      port:443,path:'/stripe/events',method:'POST',rejectUnauthorized:true,
      servername:'hooks.example.org',agent:false,autoSelectFamily:false});
    expect(options.headers).toMatchObject({Host:'hooks.example.org',
      'Content-Type':'application/json',
      'Content-Length':Buffer.byteLength(body)});
    const pinned=await new Promise((resolve,reject)=>
      options.lookup('hooks.example.org',{},(err,address,family)=>
        err?reject(err):resolve({address,family})));
    expect(pinned).toEqual({address:'8.8.8.8',family:4});
    const client=new Stripe(['sk','test','FAKEFAKEFAKE'].join('_'));
    expect(client.webhooks.constructEvent(body,options.headers['Stripe-Signature'],
      secret).id).toBe(e.id);
    expect(body).toBe(JSON.stringify(e));
    await expect(new Promise((resolve,reject)=>
      options.lookup('evil.example.org',{},err=>err?reject(err):resolve())))
      .rejects.toThrow(/Pinned/);
  });
  it('never follows redirect or reports failed HTTP as successful delivery',async()=>{
    for(const status of [301,302,307,403,500]){
      const sender=fakeSender(status);
      const result=await deliverOriginalTestEvent({
        url:'https://hooks.example.org/events',event:event(),accountId:acct,
        types,secret,lookup,requestHttps:sender.requestHttps});
      expect(result).toMatchObject({statusCode:status,accepted:false});
      expect(sender.requests).toHaveLength(1);
    }
  });
  it('refuses private/rebinding DNS and LIVE without opening a socket',async()=>{
    let calls=0;const blocked=()=>{calls++;throw new Error('unexpected send');};
    await expect(deliverOriginalTestEvent({
      url:'https://hooks.example.org/stripe',event:event(),accountId:acct,
      types,secret,lookup:async()=>[
        {address:'8.8.8.8',family:4},{address:'10.0.0.2',family:4}],
      requestHttps:blocked})).rejects.toThrow(/private|reserved/);
    await expect(deliverOriginalTestEvent({
      url:'https://hooks.example.org/stripe',event:{...event(),livemode:true},
      accountId:acct,types,secret,lookup,requestHttps:blocked})).rejects.toThrow();
    expect(calls).toBe(0);
  });
});
