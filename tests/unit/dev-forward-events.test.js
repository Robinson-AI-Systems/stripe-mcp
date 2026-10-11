import {describe,it,expect,vi} from 'vitest';
import {randomBytes} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {encryptSecret} from '../../src/core/crypto.js';
import {makeDevForwardEventsWrite,tools}
  from '../../src/tools/dev-forward-events.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import * as meta from '../../src/tools/meta.js';
const acc='acct_TESTFORWARD',other='acct_OTHERFORWARD';
const fid='fwd_'+'a'.repeat(32),url='https://hooks.example.org/events';
const key=Buffer.alloc(32,5),secret='whsec_'+'W'.repeat(32);
const e={id:'evt_TESTFORWARD',object:'event',livemode:false,
  created:1760000000,type:'customer.created',
  data:{object:{object:'customer',id:'cus_TESTFORWARD',livemode:false}}};
const args={forwarderId:fid,requestKey:'forward-1',eventIds:[e.id]};
const result=r=>JSON.parse(r.content[0].text);
function fixture({httpStatus=202,networkFails=false}={}){
  const secretEnc=encryptSecret(secret,{aad:'stripe-dev-forwarder/'+acc+'/'+fid,key});
  const records=new Map(),changes=[];
  const db={
    recordChange:async v=>{changes.push(v);},
    getDevForwarderForDelivery:async({accountId,id})=>
      accountId===acc&&id===fid?{id,url,
        types:['customer.created'],secret_enc:secretEnc}:null,
    getDevForwarderReplay:async({accountId,requestKey})=>
      accountId===acc?records.get(requestKey)??null:null,
    reserveDevForwarderReplay:async p=>{
      const prior=records.get(p.requestKey);
      if(prior)return {id:prior.id,newlyReserved:false};
      const record={id:p.id,forwarderId:p.forwarderId,
        configDigest:p.configDigest,eventIds:p.eventIds,
        receipts:p.eventIds.map(eventId=>({eventId,status:'reserved',statusCode:null}))};
      records.set(p.requestKey,record);
      return {id:p.id,newlyReserved:true};
    },
    markDevForwarderReplayAttempt:async({requestKey,eventId})=>{
      const row=records.get(requestKey).receipts.find(x=>x.eventId===eventId);
      if(row.status!=='reserved')return false;
      row.status='uncertain';return true;
    },
    recordDevForwarderReplayReceipt:async({requestKey,eventId,status,statusCode})=>{
      const row=records.get(requestKey).receipts.find(x=>x.eventId===eventId);
      if(row.status!=='uncertain')return false;
      row.status=status;row.statusCode=statusCode;return true;
    },
    markDevForwarderUsed:async()=>true
  };
  let sends=0,providerReads=0;
  const services={
    stripeForConnection:async()=>({events:{
      list:async()=>{throw Error('unexpected list');},
      retrieve:async id=>{providerReads++;if(id!==e.id)throw Error('unknown id');
        return e;}
    }}),
    forwarderDnsLookup:async()=>[{address:'8.8.8.8',family:4}],
    forwarderHttpRequest:(_options,callback)=>{
      const req=new EventEmitter();
      req.destroy=x=>queueMicrotask(()=>req.emit('error',x));
      req.end=()=>{
        sends++;
        if(networkFails)return queueMicrotask(()=>req.emit('error',Error('offline')));
        const res=new EventEmitter();res.statusCode=httpStatus;
        queueMicrotask(()=>{callback(res);res.emit('end');});
      };
      return req;
    }
  };
  const connection={mode:'test',profile:'full',stripeAccount:acc,
    resultScope:'forwarder-a'};
  const ctx={connection,db,services};
  const op=makeDevForwardEventsWrite({encryptionKey:key});
  return {ctx,op,records,changes,metrics:()=>({sends,providerReads})};
}
describe('V-4c2 guarded original TEST webhook replay',()=>{
  it('preview does not POST; confirmed write sends exact event and stores verified HTTP receipt',async()=>{
    const f=fixture();
    const preview=result(await f.op.handler({...args,dryRun:true},f.ctx));
    expect(preview.preview).toContain(e.id);
    expect(f.metrics().sends).toBe(0);
    expect(f.records.size).toBe(0);
    const pending=result(await f.op.handler(args,f.ctx));
    expect(pending.needsConfirmation).toBe(true);
    expect(f.metrics().sends).toBe(0);
    const sent=result(await f.op.handler({...args,confirm:true},f.ctx));
    expect(sent.done).toBe(true);
    expect(sent.receipts).toEqual([{eventId:e.id,status:'accepted',statusCode:202}]);
    expect(f.metrics().sends).toBe(1);
    expect(f.changes.some(x=>x.tool==='dev_forward_events'&&!x.dryRun)).toBe(true);
    expect(JSON.stringify(sent)).not.toMatch(/whsec_|secret_enc|v1\./);
  });
  it('same requestKey cannot emit a second HTTPS POST, even when confirmed again',async()=>{
    const f=fixture();
    const first=result(await f.op.handler({...args,confirm:true},f.ctx));
    const replay=result(await f.op.handler({...args,confirm:true},f.ctx));
    expect(first.done).toBe(true);
    expect(replay.done).toBe(true);
    expect(replay.replayId).toBe(first.replayId);
    expect(f.metrics().sends).toBe(1);
  });
  it('records negative HTTP status without claiming processing',async()=>{
    const f=fixture({httpStatus:307});
    const sent=result(await f.op.handler({...args,confirm:true},f.ctx));
    expect(sent.done).toBe(false);
    expect(sent.receipts).toEqual([{eventId:e.id,status:'rejected',statusCode:307}]);
    expect(f.metrics().sends).toBe(1);
  });
  it('timeout or network interruption leaves durable uncertainty and never resends',async()=>{
    const f=fixture({networkFails:true});
    const uncertain=result(await f.op.handler({...args,confirm:true},f.ctx));
    expect(uncertain.done).toBe(false);
    expect(uncertain.receipts).toEqual([{eventId:e.id,status:'uncertain',statusCode:null}]);
    expect(f.metrics().sends).toBe(1);
    const retry=result(await f.op.handler({...args,confirm:true},f.ctx));
    expect(retry.done).toBe(false);
    expect(f.metrics().sends).toBe(1);
  });
  it('rejects foreign account, LIVE, read_only, invalid selector and missing ledger',async()=>{
    const f=fixture();
    const foreign={...f.ctx,connection:{...f.ctx.connection,stripeAccount:other}};
    await expect(f.op.handler({...args,confirm:true},foreign)).rejects.toThrow();
    const live={...f.ctx,connection:{...f.ctx.connection,mode:'live'}};
    expect((await f.op.handler({...args,confirm:true},live)).isError).toBe(true);
    await expect(f.op.handler({...args,eventIds:undefined},f.ctx)).rejects.toThrow();
    const registry={tools:[...tools,...meta.tools],
      handlers:{dev_forward_events:(a,ctx)=>makeDevForwardEventsWrite({
        encryptionKey:key}).handler(a,ctx),...meta.handlers}};
    const denied=await dispatchReadOnlyTool({registry,name:'dev_forward_events',
      args:{...args,confirm:true},db:f.ctx.db,services:f.ctx.services,
      connection:{...f.ctx.connection,profile:'read_only'}});
    expect(denied.isError).toBe(true);
    expect(f.metrics().sends).toBe(0);
  });
  it('refuses altered event selection with same retry key before another POST',async()=>{
    const f=fixture();
    await f.op.handler({...args,confirm:true},f.ctx);
    await expect(f.op.handler({...args,types:['invoice.paid'],confirm:true},f.ctx))
      .rejects.toThrow();
    expect(f.metrics().sends).toBe(1);
  });
});
