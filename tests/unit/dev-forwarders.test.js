import {describe,it,expect} from 'vitest';
import {makeDevForwarderCreateWrite,makeDevForwarderDeleteWrite,handlers,tools}
  from '../../src/tools/dev-forwarders.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import * as meta from '../../src/tools/meta.js';
import {decryptSecret} from '../../src/core/crypto.js';

const account='acct_FORWARDFAKE',other='acct_OTHERFORWARD';
const url='https://hooks.example.org/stripe/events';
const key=Buffer.alloc(32,8);
const params={url,types:['invoice.payment_failed','customer.created'],
  requestKey:'forwarder-reg-1'};
const message=r=>JSON.parse(r.content[0].text);
function fixture(){
  const rows=new Map(),changes=[];
  let encrypted=null,issuances=0,lookups=0;
  const db={
    recordChange:async c=>{changes.push(c);},
    getDevForwarderByRequestKey:async({accountId,requestKey})=>
      [...rows.values()].find(r=>r.account===accountId&&r.requestKey===requestKey)??null,
    ensureDevForwarder:async p=>{
      const existing=[...rows.values()].find(r=>r.account===p.accountId&&
        r.requestKey===p.requestKey);
      if(existing)return {id:existing.id,newlyCreated:false};
      encrypted=p.secretEnc;
      rows.set(p.id,{id:p.id,account:p.accountId,requestKey:p.requestKey,
        url:p.url,types:p.types,config_digest:p.configDigest,
        created_at:new Date(),last_used_at:null,deleted_at:null});
      return {id:p.id,newlyCreated:true};
    },
    getDevForwarder:async({accountId,id,includeDeleted=false})=>{
      const row=rows.get(id);
      return row?.account===accountId&&(includeDeleted||!row.deleted_at)?row:null;
    },
    listDevForwarders:async({accountId,limit,offset})=>
      [...rows.values()].filter(r=>r.account===accountId&&!r.deleted_at)
        .slice(offset,offset+limit),
    deleteDevForwarder:async({accountId,id})=>{
      const row=rows.get(id);
      if(!row||row.account!==accountId||row.deleted_at)return false;
      row.deleted_at=new Date();return true;
    }
  };
  const setupPath='/api/stripe/setup?show='+'x'.repeat(32);
  const services={
    forwarderDnsLookup:async()=>{lookups++;return [{address:'8.8.8.8',family:4}];},
    forwarderOneTimeStore:{issue:async()=>{issuances++;return {setupPath};}}
  };
  const connection={stripeAccount:account,mode:'test',profile:'full'};
  const ctx={db,connection,services};
  const create=makeDevForwarderCreateWrite({encryptionKey:key});
  const remove=makeDevForwarderDeleteWrite();
  return {rows,changes,db,ctx,create,remove,
    stats:()=>({encrypted,issuances,lookups})};
}
describe('V-4b2 forwarder management contracts',()=>{
  it('previews without secret creation, requires confirm, and issues only a setup link',async()=>{
    const f=fixture();
    const preview=message(await f.create.handler({...params,dryRun:true},f.ctx));
    expect(preview.preview).toContain(url);
    expect(f.rows.size).toBe(0);
    expect(f.stats().issuances).toBe(0);
    const pending=message(await f.create.handler(params,f.ctx));
    expect(pending.needsConfirmation).toBe(true);
    expect(f.rows.size).toBe(0);
    const created=message(await f.create.handler({...params,confirm:true},f.ctx));
    expect(created.done).toBe(true);
    expect(created.forwarderId).toMatch(/^fwd_[a-f0-9]{32}$/);
    expect(created.setupPath).toContain('/api/stripe/setup?show=');
    expect(JSON.stringify(created)).not.toMatch(/whsec_|secretEnc|secret_enc/);
    expect(f.stats().encrypted).toMatch(/^v1\./);
    const recovered=decryptSecret(f.stats().encrypted,{
      aad:'stripe-dev-forwarder/'+account+'/'+created.forwarderId,key});
    expect(recovered).toMatch(/^whsec_[A-Za-z0-9_-]{24,}$/);
    expect(f.stats().issuances).toBe(1);
    expect(f.changes.some(x=>x.tool==='dev_create_forwarder'&&x.dryRun===false)).toBe(true);
  });
  it('idempotent replay cannot rotate signing secret or issue another link',async()=>{
    const f=fixture();
    const first=message(await f.create.handler({...params,confirm:true},f.ctx));
    const original=f.stats().encrypted;
    const replay=message(await f.create.handler({...params,confirm:true},f.ctx));
    expect(replay.done).toBe(true);
    expect(replay).not.toHaveProperty('setupPath');
    expect(f.rows.size).toBe(1);
    expect(f.stats()).toMatchObject({encrypted:original,issuances:1,lookups:1});
    expect(first.forwarderId).toMatch(/^fwd_/);
    await expect(f.create.handler({...params,
      url:'https://different.example.org/hook',confirm:true},f.ctx))
      .rejects.toThrow(/Retry key/);
    expect(f.rows.size).toBe(1);
  });
  it('refuses private DNS, invalid URL, unsorted duplicates and LIVE preflight',async()=>{
    const f=fixture();
    const invalid=[{...params,url:'https://127.0.0.1/private'},
      {...params,types:['customer.created','customer.created']},
      {...params,types:[]},{...params,requestKey:''}];
    for(const p of invalid)await expect(f.create.handler({...p,confirm:true},f.ctx))
      .rejects.toThrow();
    const live={...f.ctx,connection:{...f.ctx.connection,mode:'live'}};
    expect((await f.create.handler({...params,confirm:true},live)).isError).toBe(true);
    expect((await handlers.dev_list_forwarders({},live)).isError).toBe(true);
    expect((await f.remove.handler({forwarderId:'fwd_'+'a'.repeat(32),
      requestKey:'r',confirm:true},live)).isError).toBe(true);
    expect(f.rows.size).toBe(0);
  });
  it('lists safe selected-account records only, with read_only profile allowed',async()=>{
    const f=fixture();
    const created=message(await f.create.handler({...params,confirm:true},f.ctx));
    const registry={tools:[...tools,...meta.tools],
      handlers:{...handlers,...meta.handlers}};
    const result=await dispatchReadOnlyTool({registry,name:'dev_list_forwarders',
      args:{limit:20},db:f.db,services:f.ctx.services,connection:{
        ...f.ctx.connection,profile:'read_only'}});
    const listing=message(result);
    expect(listing.data.map(x=>x.id)).toEqual([created.forwarderId]);
    expect(JSON.stringify(listing)).not.toMatch(/v1\.|whsec_|secret_enc/);
    const foreign=message(await handlers.dev_list_forwarders({},{
      ...f.ctx,connection:{...f.ctx.connection,stripeAccount:other}}));
    expect(foreign.data).toEqual([]);
    const denied=await dispatchReadOnlyTool({registry,name:'dev_create_forwarder',
      args:{...params,confirm:true},db:f.db,services:f.ctx.services,
      connection:{...f.ctx.connection,profile:'read_only'}});
    expect(denied.isError).toBe(true);
  });
  it('guarded deletion forbids foreign account, disables delivery and can replay',async()=>{
    const f=fixture();
    const created=message(await f.create.handler({...params,confirm:true},f.ctx));
    const args={forwarderId:created.forwarderId,requestKey:'remove-1'};
    const foreign={...f.ctx,connection:{...f.ctx.connection,stripeAccount:other}};
    await expect(f.remove.handler({...args,confirm:true},foreign)).rejects.toThrow();
    expect(message(await f.remove.handler({...args,dryRun:true},f.ctx))
      .preview).toContain('Permanently disable');
    expect(f.rows.get(created.forwarderId).deleted_at).toBeNull();
    expect(message(await f.remove.handler({...args,confirm:true},f.ctx)).done).toBe(true);
    expect(f.rows.get(created.forwarderId).deleted_at).toBeTruthy();
    expect(message(await f.remove.handler({...args,confirm:true},f.ctx)).done).toBe(true);
    expect(message(await handlers.dev_list_forwarders({},f.ctx)).data).toEqual([]);
  });
  it('fails closed when durable audit, encrypted storage or owner handoff missing',async()=>{
    const f=fixture();
    const noAudit={...f.ctx,db:{...f.db,recordChange:undefined}};
    const a=await f.create.handler({...params,confirm:true},noAudit);
    expect(a.isError).toBe(true);
    expect(f.rows.size).toBe(0);
    const badOneTime={...f.ctx,services:{...f.ctx.services,
      forwarderOneTimeStore:{issue:async()=>{throw new Error('unavailable');}}}};
    const b=await f.create.handler({...params,confirm:true},badOneTime);
    expect(b.isError===true||message(b).done===false).toBe(true);
    expect(f.rows.size).toBe(0);
  });
});
