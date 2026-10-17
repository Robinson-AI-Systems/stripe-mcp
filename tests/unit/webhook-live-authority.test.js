import {describe,it,expect,vi,afterEach} from 'vitest';
import {createHash} from 'node:crypto';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {isGuardedLiveWrite,listingForConnection} from '../../src/core/profiles.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
import {registry} from '../../src/tools/index.js';
import {handlers as readers,webhookSafe} from '../../src/tools/webhooks-read.js';
import {handlers as events} from '../../src/tools/webhook-event-writes.js';
import {handlers as maintenance} from '../../src/tools/webhook-maintenance.js';
import {handlers as creates} from '../../src/tools/webhook-create.js';
const acct='acct_LIVEHOOKS',eid='we_LIVEHOOK1',newid='we_LIVENEW1';
const url='https://hooks.public-domain.org/sensitive-path?token=SECRET_SENTINEL';
const safeUrl='https://updated.public-domain.org/new-events';
const secret='whsec_'+'S'.repeat(40);
const parse=output=>JSON.parse(output.content[0].text);
const eventsInitial=['customer.updated','invoice.paid'];
afterEach(()=>vi.unstubAllEnvs());
function fixture({grant=true,enabled=true,mode='live',providerMode='live',
  appOwned=false,connect=false,stale=false,uncertain=false,missingSecret=false,
  duplicate=false,uncertainCreate=false,readOnly=false}={}){
  vi.stubEnv('VERCEL_ENV','production');
  const db=createFakeDb({accounts:[{id:acct,label:'Independent LIVE account',
    live_enabled:enabled,live_connected:true,money_limit_cents:50000}]});
  const entries=new Map(),keyEvidence=[];
  const provider={reads:0,updates:0,deletes:0,creates:0,lists:0,seenSecretModes:[]};
  let created=null, changedRead=false;
  let endpoint={id:eid,object:'webhook_endpoint',
    livemode:providerMode==='live',created:1695680197,status:'enabled',
    enabled_events:[...eventsInitial],url,
    application:appOwned?'ca_OWNED':null,connect,
    description:'private description',api_version:null,
    metadata:appOwned?{agreementId:'privateApp'}:{}};
  function clone(v){return v&&{...v,enabled_events:[...v.enabled_events]};}
  const sdk={
    accounts:{retrieve:async()=>({id:acct,object:'account'})},
    balance:{retrieve:async()=>({object:'balance',livemode:providerMode==='live'})},
    webhookEndpoints:{
      list:async()=>{provider.lists++;return {object:'list',
        has_more:false,data:[...endpoint?[clone(endpoint)]:[],...created?[clone(created)]:[]]};},
      retrieve:async id=>{
        provider.reads++;
        if(stale&&!changedRead&&provider.reads>=2&&id===eid){
          changedRead=true;return {...clone(endpoint),description:'outside concurrent change'};
        }
        if(id===eid&&endpoint)return clone(endpoint);
        if(id===newid&&created)return clone(created);
        throw Object.assign(new Error('not found'),{statusCode:404,code:'resource_missing'});
      },
      update:async(id,body,opts)=>{
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        provider.updates++;
        if(!uncertain)endpoint={...endpoint,...body};
        return clone(endpoint);
      },
      del:async(id,_body,opts)=>{
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        provider.deletes++;
        if(!uncertain)endpoint=null;
        return {id,object:'webhook_endpoint',deleted:true};
      },
      create:async(body,opts)=>{
        expect(opts.idempotencyKey).toMatch(/^rmcp_/);
        expect(body).toMatchObject({url:safeUrl,enabled_events:['invoice.paid']});
        provider.creates++;
        if(uncertainCreate)throw new Error('Provider response uncertain');
        created={id:newid,object:'webhook_endpoint',livemode:providerMode==='live',
          created:1695680198,status:'enabled',enabled_events:['invoice.paid'],
          url:safeUrl,application:null,connect:false,
          description:'',api_version:null,metadata:{}};
        return {...clone(created),...missingSecret?{}:{secret}};
      }
    }
  };
  db.getWebhookCreate=async p=>{
    keyEvidence.push({op:'get',key:p.requestKey});
    const record=entries.get(p.accountId+':'+p.requestKey);
    if(record&&record.digest!==p.digest)throw Error('Changed configuration');
    return record?{state:record.state,endpointId:record.endpointId}:null;
  };
  db.reserveWebhookCreate=async p=>{
    keyEvidence.push({op:'reserve',key:p.requestKey});
    const k=p.accountId+':'+p.requestKey,prev=entries.get(k);
    if(prev){if(prev.digest!==p.digest)throw Error('Changed configuration');
      return {newlyReserved:false,state:prev.state,endpointId:prev.endpointId};}
    entries.set(k,{digest:p.digest,state:'reserved',endpointId:null});
    return {newlyReserved:true};
  };
  db.completeWebhookCreate=async p=>{
    const v=entries.get(p.accountId+':'+p.requestKey);
    if(!v||v.digest!==p.digest||v.state!=='reserved')return false;
    v.state='confirmed';v.endpointId=p.endpointId;return true;
  };
  const ctx={db,connection:{stripeAccount:acct,mode,profile:readOnly?'read_only':'full',
    rtcLiveOwnerApproved:grant,moneyLimitCents:0,listing:'catalog'},
  connectionId:'synthetic-hook-scope',liveAccessGranted:grant,
  services:{stripeForConnection:async c=>{
    expect(c).toMatchObject({stripeAccount:acct,mode});return sdk;
  },webhookDnsLookup:async()=>[{address:'8.8.8.8',family:4}],
  webhookOneTimeStore:{issue:async({mode,account,kind,secret:privateSecret})=>{
    provider.seenSecretModes.push({mode,account,kind});
    expect(privateSecret).toBe(secret);
    return {setupPath:'/api/stripe/setup?show='+'a'.repeat(32)};
  }}}};
  return {ctx,db,sdk,provider,keyEvidence,entries,
    call:(handler,args,context=ctx)=>handler(args,context)};
}
const opt={endpointId:eid,requestKey:'stable-request'};
describe('G-4 webhook lifecycle — end-user LIVE delegation versus developer safety',()=>{
  it('advertises only the five reviewed LIVE writes to an owner, never read_only/no-consent',()=>{
    const f=fixture();
    const names=['webhook_create','webhook_add_events','webhook_remove_events',
      'webhook_update','webhook_delete'];
    for(const name of names){
      const tool=registry.tools.find(t=>t.name===name);
      expect(tool?.writeContract).toBe('defineWrite-v1');
      expect(isGuardedLiveWrite(tool,f.ctx.connection)).toBe(true);
      expect(isGuardedLiveWrite(tool,{...f.ctx.connection,
        rtcLiveOwnerApproved:false})).toBe(false);
      expect(isGuardedLiveWrite(tool,{...f.ctx.connection,
        profile:'read_only'})).toBe(false);
    }
    const visible=listingForConnection(registry,f.ctx.connection).filter(t=>
      t.area==='webhooks'&&t.writes===true).map(t=>t.name).sort();
    expect(visible).toEqual([...names].sort());
    expect(listingForConnection(registry,{...f.ctx.connection,rtcLiveOwnerApproved:false})
      .some(t=>t.name==='webhook_delete')).toBe(false);
  });
  it('reads LIVE webhook list/detail with redacted URL path/secret and matching provider mode',async()=>{
    const f=fixture();
    const listed=parse(await f.call(readers.webhook_list,{detail:'full'}));
    expect(listed.data).toMatchObject([{id:eid,destinationOrigin:'https://hooks.public-domain.org'}]);
    const full=parse(await f.call(readers.webhook_get,{endpointId:eid,detail:'full'}));
    expect(full).toMatchObject({id:eid,enabledEventCount:2,source:'verified_complete_provider_endpoint'});
    expect(JSON.stringify({listed,full})).not.toContain('SECRET_SENTINEL');
    const throughMcp=await dispatchReadOnlyTool({registry,name:'webhook_get',
      args:{endpointId:eid},connection:f.ctx.connection,
      services:f.ctx.services,db:f.ctx.db});
    expect(throughMcp.isError).toBeUndefined();
    expect(JSON.stringify(throughMcp)).not.toContain('SECRET_SENTINEL');
    expect(()=>webhookSafe({...f.sdk,object:'webhook_endpoint',id:eid}, {mode:'live'})).toThrow();
  });
  it('guards LIVE event additions/removals and preserves unrelated subscriptions',async()=>{
    const f=fixture();
    const args={...opt,events:['charge.succeeded']};
    const preview=parse(await f.call(events.webhook_add_events,args));
    expect(preview).toMatchObject({mode:'LIVE',done:false,needsConfirmation:true});
    expect(f.provider.updates).toBe(0);
    const added=parse(await f.call(events.webhook_add_events,{...args,confirm:true}));
    expect(added).toMatchObject({done:true,confirmed:true,mode:'LIVE'});
    expect(f.provider.updates).toBe(1);
    const current=await f.sdk.webhookEndpoints.retrieve(eid);
    expect(current.enabled_events).toEqual(['charge.succeeded','customer.updated','invoice.paid']);
    const removed=parse(await f.call(events.webhook_remove_events,{
      endpointId:eid,events:['customer.updated'],requestKey:'remove-once',confirm:true}));
    expect(removed).toMatchObject({done:true,confirmed:true,mode:'LIVE'});
    expect((await f.sdk.webhookEndpoints.retrieve(eid)).enabled_events)
      .toEqual(['charge.succeeded','invoice.paid']);
  });
  it('updates and deletes only matching LIVE endpoints and verifies a provider tombstone',async()=>{
    const f=fixture();
    const before=parse(await f.call(maintenance.webhook_update,{
      ...opt,description:'safe new description'}));
    expect(before).toMatchObject({mode:'LIVE',needsConfirmation:true});
    expect(f.provider.updates).toBe(0);
    const updated=parse(await f.call(maintenance.webhook_update,{
      ...opt,description:'safe new description',confirm:true}));
    expect(updated).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    const deleted=parse(await f.call(maintenance.webhook_delete,{
      ...opt,requestKey:'delete-live-once',confirm:true}));
    expect(deleted).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    expect(f.provider.deletes).toBe(1);
    expect(JSON.stringify({before,updated,deleted})).not.toContain('SECRET_SENTINEL');
  });
  it('creates a LIVE webhook exactly once, encrypts the private one-time secret with LIVE mode',async()=>{
    const f=fixture(),args={url:safeUrl,events:['invoice.paid'],
      requestKey:'same-between-modes'};
    // Simulate a previously recorded TEST reservation with the raw same key.
    const digest=createHash('sha256').update('unrelated TEST').digest('hex');
    await f.db.reserveWebhookCreate({accountId:acct,
      requestKey:args.requestKey,digest});
    const dry=parse(await f.call(creates.webhook_create,args));
    expect(dry).toMatchObject({mode:'LIVE',needsConfirmation:true});
    expect(f.provider.creates).toBe(0);
    const out=parse(await f.call(creates.webhook_create,{...args,confirm:true}));
    expect(out).toMatchObject({mode:'LIVE',done:true,confirmed:true,
      endpointId:newid,secretShownInTool:false});
    expect(out.setupPath).toMatch(/^\/api\/stripe\/setup\?show=/);
    expect(f.provider.creates).toBe(1);
    expect(f.provider.seenSecretModes).toEqual([{
      mode:'live',account:acct,kind:'native-webhook-signing-secret'}]);
    expect(f.keyEvidence.some(x=>x.key.startsWith('live_')&&x.key.length===69)).toBe(true);
    expect(JSON.stringify({dry,out})).not.toContain(secret);
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toContain(secret);
    const repeated=parse(await f.call(creates.webhook_create,{...args,confirm:true}));
    expect(repeated).toMatchObject({mode:'LIVE',done:true,confirmed:true});
    expect(repeated).not.toHaveProperty('setupPath');
    expect(f.provider.creates).toBe(1);
  });
  it('disabled account, missing owner consent, missing production, foreign mode deny before writes',async()=>{
    const mutation={...opt,events:['charge.succeeded'],confirm:true};
    for(const scenario of [{grant:false},{enabled:false},{providerMode:'test'}]){
      const f=fixture(scenario);
      const result=await f.call(events.webhook_add_events,mutation);
      expect(result.isError).toBe(true);
      expect(f.provider.updates).toBe(0);
      const listed=await f.call(readers.webhook_list,{});
      if(scenario.enabled===false||scenario.providerMode==='test')
        expect(listed.isError).toBe(true);
      const create=await f.call(creates.webhook_create,{
        url:safeUrl,events:['invoice.paid'],requestKey:'not-authorized',confirm:true});
      expect(create.isError).toBe(true);
      expect(f.provider.creates).toBe(0);
    }
    const f=fixture();
    vi.stubEnv('VERCEL_ENV','preview');
    expect((await f.call(maintenance.webhook_delete,{...opt,confirm:true})).isError).toBe(true);
    expect(f.provider.deletes).toBe(0);
    const readOnly=fixture({readOnly:true});
    expect((await dispatchReadOnlyTool({registry,name:'webhook_delete',
      args:{...opt,confirm:true},connection:readOnly.ctx.connection,
      services:readOnly.ctx.services,db:readOnly.ctx.db})).isError).toBe(true);
  });
  it('rejects Connect/app-owned targets, stale changes and unknown provider outcomes',async()=>{
    for(const opts of [{appOwned:true},{connect:true},{stale:true},{uncertain:true}]){
      const f=fixture(opts),args={...opt,description:'changed',confirm:true};
      let result;
      try{result=await f.call(maintenance.webhook_update,args);}
      catch{result={isError:true};}
      expect(result.isError===true||parse(result).done===false).toBe(true);
      if(opts.appOwned||opts.connect||opts.stale)expect(f.provider.updates).toBe(0);
    }
    for(const opts of [{missingSecret:true},{uncertainCreate:true},{providerMode:'test'}]){
      const f=fixture(opts),args={url:safeUrl,events:['invoice.paid'],
        requestKey:'unknown-outcome',confirm:true};
      const result=await f.call(creates.webhook_create,args);
      expect(result.isError===true||parse(result).done===false).toBe(true);
      const before=f.provider.creates;
      await f.call(creates.webhook_create,args);
      expect(f.provider.creates).toBe(before);
      expect(f.provider.seenSecretModes).toEqual([]);
    }
  });
});
