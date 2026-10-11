import {describe,it,expect,vi} from 'vitest';
import {makeWebhookCreate,tools,handlers} from '../../src/tools/webhook-create.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const key='safe-webhook-create',account='acct_CREATEFAKE';
const url='https://hooks.public-domain.org/stripe/events';
const args={url,events:['invoice.paid'],requestKey:key};
const parse=x=>JSON.parse(x.content[0].text);
const privateSecret='whsec_'+'X'.repeat(40);
function fixture({uncertain=false,missingSecret=false,invalidRead=false}={}){
  const ledger=new Map(),db=createFakeDb();
  let endpoint=null,links=0;
  db.getWebhookCreate=async({accountId,requestKey,digest})=>{
    const x=ledger.get(accountId+':'+requestKey);
    if(x&&x.digest!==digest)throw new TypeError('Changed configuration');
    return x?{state:x.state,endpointId:x.endpointId}:null;
  };
  db.reserveWebhookCreate=async p=>{
    const id=p.accountId+':'+p.requestKey,old=await db.getWebhookCreate(p);
    if(old)return {...old,newlyReserved:false};
    ledger.set(id,{digest:p.digest,state:'reserved',endpointId:null});
    return {newlyReserved:true};
  };
  db.completeWebhookCreate=async p=>{
    const x=ledger.get(p.accountId+':'+p.requestKey);
    if(!x||x.state!=='reserved'||x.digest!==p.digest)return false;
    x.state='confirmed';x.endpointId=p.endpointId;return true;
  };
  const base={id:'we_FAKECREATE',object:'webhook_endpoint',livemode:false,
    created:1695680197,status:'enabled',enabled_events:['invoice.paid'],
    url,application:null,connect:false,description:'',api_version:null};
  const sdk={webhookEndpoints:{
    create:vi.fn(async()=>{
      if(uncertain)throw new Error('transport timed out');
      endpoint={...base};return {...base,...(missingSecret?{}:{secret:privateSecret})};
    }),
    retrieve:vi.fn(async()=>invalidRead?{...base,url:'https://different.test/hook'}:endpoint)
  }};
  const services={stripeForConnection:async()=>sdk,
    webhookDnsLookup:async()=>[{address:'8.8.8.8',family:4}],
    webhookOneTimeStore:{issue:async({secret})=>{
      expect(secret).toBe(privateSecret);links++;
      return {setupPath:'/api/stripe/setup?show='+'a'.repeat(32)};
    }}};
  const ctx={db,services,connectionId:'webhook-fixture',
    connection:{stripeAccount:account,mode:'test',profile:'full'}};
  return {ctx,db,sdk,ledger,create:a=>makeWebhookCreate().handler(a,ctx),
    counts:()=>({links})};
}
describe('G-4d2 TEST native webhook owner secret handoff',()=>{
  it('registers one guarded full-only tool and denies indirect reads',async()=>{
    expect(tools.map(x=>x.name)).toEqual(['webhook_create']);
    expect(tools[0].writeContract).toBe('defineWrite-v1');
    expect(registry.tools.filter(x=>x.name==='webhook_create')).toHaveLength(1);
    const f=fixture();
    const response=await dispatchReadOnlyTool({registry,name:'webhook_create',
      args:{...args,confirm:true},connection:{...f.ctx.connection,profile:'read_only'},
      db:f.db,services:f.ctx.services});
    expect(response.isError).toBe(true);
    expect(f.sdk.webhookEndpoints.create).not.toHaveBeenCalled();
  });
  it('previews safely without writing; confirmed creates and reveals owner link once',async()=>{
    const f=fixture();
    expect(parse(await f.create({...args,dryRun:true})).preview).toContain('hooks.public-domain.org');
    expect(parse(await f.create(args)).needsConfirmation).toBe(true);
    expect(f.sdk.webhookEndpoints.create).not.toHaveBeenCalled();
    const response=parse(await f.create({...args,confirm:true}));
    expect(response).toMatchObject({done:true,confirmed:true,secretShownInTool:false,
      endpointId:'we_FAKECREATE'});
    expect(response.setupPath).toMatch(/^\/api\/stripe\/setup\?show=/);
    expect(JSON.stringify(response)).not.toContain(privateSecret);
    expect(f.sdk.webhookEndpoints.create).toHaveBeenCalledTimes(1);
    const again=parse(await f.create({...args,confirm:true}));
    expect(again).toMatchObject({done:true,confirmed:true});
    expect(again).not.toHaveProperty('setupPath');
    expect(f.sdk.webhookEndpoints.create).toHaveBeenCalledTimes(1);
    expect(f.counts().links).toBe(1);
    expect(JSON.stringify(await f.db.listAuditForTest())).not.toContain(privateSecret);
  });
  it('uncertain POST is never replayed; missing secret never fabricates success',async()=>{
    for(const options of [{uncertain:true},{missingSecret:true}]){
      const f=fixture(options);
      expect(parse(await f.create({...args,confirm:true})).done).toBe(false);
      expect(parse(await f.create({...args,confirm:true})).done).toBe(false);
      expect(f.sdk.webhookEndpoints.create).toHaveBeenCalledTimes(1);
      expect(f.counts().links).toBe(0);
    }
  });
  it('read-back mismatch, changed digest, LIVE and invalid targets fail closed',async()=>{
    const f=fixture({invalidRead:true});
    expect(parse(await f.create({...args,confirm:true})).confirmed).toBe(false);
    await expect(f.create({...args,events:['charge.succeeded'],confirm:true}))
      .rejects.toThrow(/Changed configuration/);
    expect(f.sdk.webhookEndpoints.create).toHaveBeenCalledTimes(1);
    const live=await handlers.webhook_create({...args,confirm:true},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}});
    expect(live.isError).toBe(true);
    await expect(f.create({...args,url:'http://127.0.0.1/hook'})).rejects.toThrow();
    await expect(f.create({...args,events:['*']})).rejects.toThrow();
    await expect(f.create({...args,requestKey:''})).rejects.toThrow();
  });
});
