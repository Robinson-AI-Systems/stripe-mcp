import {describe,it,expect,vi} from 'vitest';
import {draftFromFindings,normalizedSetup,appNeeds} from '../../src/projects/setup.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
import {registry} from '../../src/tools/index.js';
import {dispatchReadOnlyTool} from '../../src/core/mcp-server.js';
const account='acct_PROJECT123',parse=r=>JSON.parse(r.content[0].text);
const base={
  id:'new-business',name:'New Business',website:'https://new-business.example.com',
  webhookEvents:[],metadataKeys:[],stripeCalls:['stripe.prices.list'],
  checkoutModes:['payment'],paymentMethods:['card'],
  ownsCatalog:false,ownsTaxRates:false,
  keyPermissions:{read:['products'],write:['prices']},
  portalRules:{allow_cancel:false,allow_plan_switch:false,
    allow_payment_method_update:true,allow_invoice_history:true}
};
const project=(changes={})=>({...structuredClone(base),
  billing:{kind:'monthly',productName:'Basic subscription',
    amountCents:3600,lookupKey:'basic_monthly'},...changes});
function fixture(){
  const db=createFakeDb({accounts:[{id:account,label:'P4 setup'}]});
  const product=new Map(),price=new Map(),portals=new Map(),writes=[];
  const webhookLedger=new Map();let webhook=null;
  db.getWebhookCreate=async({accountId,requestKey,digest})=>{
    const v=webhookLedger.get(accountId+':'+requestKey);
    if(v&&v.digest!==digest)throw new TypeError('Changed webhook parameters');
    return v?{state:v.state,endpointId:v.endpointId}:null;
  };
  db.reserveWebhookCreate=async p=>{
    const key=p.accountId+':'+p.requestKey;
    if(webhookLedger.has(key))return {newlyReserved:false};
    webhookLedger.set(key,{digest:p.digest,state:'reserved',endpointId:null});
    return {newlyReserved:true};
  };
  db.completeWebhookCreate=async p=>{
    const v=webhookLedger.get(p.accountId+':'+p.requestKey);
    if(v?.digest!==p.digest||v.state!=='reserved')return false;
    v.state='confirmed';v.endpointId=p.endpointId;return true;
  };
  const sdk={
    accounts:{retrieve:vi.fn(async()=>({id:account,object:'account',livemode:false}))},
    webhookEndpoints:{
      create:vi.fn(async(a,o)=>{
        writes.push({kind:'webhook',args:a,opts:o});
        webhook={id:'we_PROJECT123',object:'webhook_endpoint',livemode:false,
          enabled_events:a.enabled_events,url:a.url,description:a.description,
          status:'enabled',application:null,connect:false,created:1690000000,
          secret:'whsec_'+'A'.repeat(40)};
        return webhook;
      }),
      retrieve:vi.fn(async()=>webhook)
    },
    billingPortal:{configurations:{
      create:vi.fn(async(args,opts)=>{
        writes.push({kind:'portal',args,opts});
        const value={id:'bpc_NEW123',object:'billing_portal.configuration',livemode:false,
          active:true,features:structuredClone(args.features)};
        portals.set(value.id,value);return value;
      }),
      retrieve:vi.fn(async id=>portals.get(id))
    }},
    products:{
      create:vi.fn(async(a,o)=>{
        writes.push({kind:'product',args:a,opts:o});
        const p={id:'prod_PROJECT123',object:'product',livemode:false,
          name:a.name,active:true,description:null,metadata:{}};
        product.set(p.id,p);return p;
      }),
      retrieve:vi.fn(async id=>product.get(id)),
      list:vi.fn(async()=>({data:[...product.values()],has_more:false}))
    },
    prices:{
      create:vi.fn(async(a,o)=>{
        writes.push({kind:'price',args:a,opts:o});
        const p={id:'price_PROJECT123',object:'price',livemode:false,active:true,
          product:a.product,lookup_key:a.lookup_key,unit_amount:a.unit_amount,
          currency:a.currency,type:a.recurring?'recurring':'one_time',
          recurring:a.recurring??null,metadata:{},nickname:null};
        price.set(p.id,p);return p;
      }),
      list:vi.fn(async a=>({data:[...price.values()].filter(p=>
        a.lookup_keys?.includes(p.lookup_key)??true),has_more:false})),
      retrieve:vi.fn(async id=>price.get(id))
    }
  };
  const ctx={db,connectionId:'p4-unit',connection:{stripeAccount:account,
    mode:'test',profile:'full'},services:{stripeForConnection:async()=>sdk,
      webhookDnsLookup:async()=>[{address:'8.8.8.8',family:4}],
      webhookOneTimeStore:{issue:async()=>({setupPath:'/api/stripe/setup?show='+'a'.repeat(32)})}}};
  const call=(name,a={})=>registry.handlers[name](a,ctx);
  const setup=(p=project(),opts={})=>call('workflow_project_setup',{
    project:p,requestKey:'setup-once',confirm:true,...opts});
  return {db,ctx,call,setup,project,product,price,writes,sdk};
}
describe('P-4 draft from codebase findings',()=>{
  it('never fetches code, invents unknown event names or activates an app',async()=>{
    const f=fixture();
    const result=parse(await f.call('project_draft_profile',{findings:{
      ...base,webhookUrl:'https://new-business.example.com/webhooks',
      webhookEvents:['invoice.paid','custom.unverified']}}));
    expect(result.status).toBe('draft');
    expect(result.accountBound).toBe(false);
    expect(result.active).toBe(false);
    expect(result.unrecognizedEvents).toEqual(['custom.unverified']);
    expect(result.profile.webhook_events).toEqual(['invoice.paid']);
    expect(result.missing.join(' ')).toContain('custom.unverified');
    expect(result.appNeeds).toContain('APP-NEEDS — New Business');
    expect(result.appNeeds).not.toContain('sk_test_');
    expect(await f.db.getKnownApp(base.id)).toBeNull();
    expect(f.writes).toHaveLength(0);
  });
  it('requires explicit ownership, payment, webhook and Portal facts; never guesses',()=>{
    expect(()=>draftFromFindings({...base,ownsCatalog:undefined})).toThrow(/Confirm/);
    expect(()=>draftFromFindings({...base,portalRules:{allow_cancel:true}}))
      .toThrow(/Portal/);
    expect(()=>normalizedSetup(project({webhookEvents:['custom.unverified'],
      webhookUrl:'https://new-business.example.com/hook'}))).toThrow(/unknown/);
    expect(()=>normalizedSetup(project({billing:{kind:'monthly',productName:'Plan',
      amountCents:2500,lookupKey:'Plan With Spaces'}}))).toThrow(/lookup/);
    expect(()=>draftFromFindings({...base,website:'http://localhost'})).toThrow(/HTTPS/);
  });
  it('produces stable plans and APP-NEEDS text when fields reorder',()=>{
    const a=project(),b=Object.fromEntries(Object.entries(a).reverse());
    expect(normalizedSetup(a).digest).toBe(normalizedSetup(b).digest);
    expect(normalizedSetup(a).steps).toEqual(['portal','product','price','draft']);
    expect(appNeeds(draftFromFindings(base))).toContain('Restricted key permissions');
  });
});
describe('P-4 durable guarded setup and exact native step receipts',()=>{
  it('previews a step with no writes, advances through E-1 catalog and finishes one draft',async()=>{
    const f=fixture(),p=project();
    const preview=parse(await f.setup(p,{dryRun:true,confirm:false}));
    expect(preview.done).toBe(false);
    expect(preview.preview).toContain('ONLY portal');
    expect(f.writes).toHaveLength(0);
    for(const expected of ['portal','product','price','draft']){
      const current=parse(await f.setup(p));
      expect(current.done).toBe(true);
      expect(current.steps.find(x=>x.name===expected)).toMatchObject({state:'done'});
      expect(current.steps.every(x=>x.state!=='pending')).toBe(true);
    }
    expect(f.writes.map(x=>x.kind)).toEqual(['portal','product','price']);
    expect(f.sdk.prices.create.mock.calls[0][0]).toMatchObject({
      product:'prod_PROJECT123',lookup_key:'basic_monthly',
      unit_amount:3600,currency:'usd',
      recurring:{interval:'month',interval_count:1,usage_type:'licensed'}});
    const finished=parse(await f.setup(p));
    expect(finished).toMatchObject({done:true,status:'draft_created',
      accountBound:false,liveEnabled:false});
    expect(f.writes).toHaveLength(3);
    const draft=await f.db.getKnownApp('new-business');
    expect(draft.status).toBe('draft');
    expect(draft.profile.stripe_accounts).toEqual([]);
    expect(await f.db.listKnownAppsForAccount(account)).toEqual([]);
    expect(finished.appNeeds).toContain('Commit this text only in the project repository');
  });
  it('uses wrapped webhook with owner-only one-time handoff, then no duplicate',async()=>{
    const f=fixture(),p=project({webhookUrl:'https://hooks.public-domain.org/stripe/events',
      webhookEvents:['invoice.paid']});
    const first=parse(await f.setup(p));
    expect(first).toMatchObject({done:true,nextStep:'portal'});
    expect(first.ownerSetupPath).toMatch(/^\/api\/stripe\/setup\?show=/);
    expect(JSON.stringify(first)).not.toContain('whsec_');
    for(let i=0;i<4;i++)expect(parse(await f.setup(p)).done).toBe(true);
    const repeat=parse(await f.setup(p));
    expect(repeat.status).toBe('draft_created');
    expect(f.sdk.webhookEndpoints.create).toHaveBeenCalledTimes(1);
    expect(f.writes.map(x=>x.kind)).toEqual(['webhook','portal','product','price']);
  });
  it('own-catalog project never creates products, prices or tax rates',async()=>{
    const f=fixture(),p=project({ownsCatalog:true,billing:{kind:'one_time'},
      id:'owned-business'});
    expect(normalizedSetup(p).steps).toEqual(['portal','draft']);
    expect(parse(await f.setup(p)).done).toBe(true);
    expect(parse(await f.setup(p)).status).toBe('draft_created');
    expect(f.writes.map(x=>x.kind)).toEqual(['portal']);
    expect(f.sdk.products.create).not.toHaveBeenCalled();
    expect(f.sdk.prices.create).not.toHaveBeenCalled();
  });
  it('refuses LIVE and read-only direct dispatch before a mutation',async()=>{
    const f=fixture(),p=project();
    const bad=await registry.handlers.workflow_project_setup({
      project:p,requestKey:'denied',confirm:true},{...f.ctx,
      connection:{...f.ctx.connection,mode:'live'}});
    expect(bad.isError).toBe(true);
    const denied=await dispatchReadOnlyTool({registry,name:'workflow_project_setup',
      args:{project:p,requestKey:'denied',confirm:true},
      connection:{...f.ctx.connection,profile:'read_only'},
      db:f.db,services:f.ctx.services});
    expect(denied.isError).toBe(true);
    expect(f.writes).toHaveLength(0);
  });
  it('leaves an uncertain child reservation pending; never silently replays',async()=>{
    const f=fixture(),p=project();
    f.db.completeProjectSetupStep=async()=>{throw Error('simulated durable outage')};
    const first=parse(await f.setup(p));
    expect(first.done).toBe(false);
    expect(f.writes.map(x=>x.kind)).toEqual(['portal']);
    await expect(f.setup(p)).rejects.toThrow(/outcome uncertain/);
    expect(f.writes.map(x=>x.kind)).toEqual(['portal']);
    const run=await f.db.getProjectSetupRun({account,id:p.id});
    expect(run.steps.portal.state).toBe('pending');
  });
  it('requires exact same plan on retry; never silently recycles a project ID',async()=>{
    const f=fixture(),p=project();
    parse(await f.setup(p));
    const changed=project({billing:{kind:'monthly',productName:'Altered',
      amountCents:5000,lookupKey:'other_month'}});
    const denied=await f.setup(changed);
    expect(denied.isError).toBe(true);
    expect(f.writes.map(x=>x.kind)).toEqual(['portal']);
  });
});
