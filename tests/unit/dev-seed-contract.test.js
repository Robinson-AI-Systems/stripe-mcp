// V-1a seven real-handler contract cases for a multi-Stripe-call tracked seed.
import {describe,it,expect} from 'vitest';
import {makeDevSeedWrite,handlers} from '../../src/tools/dev-seed.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const parse=r=>JSON.parse(r.content[0].text);
const account='acct_safefixture';
const req={scenario:'catalog-starter',size:1,requestKey:'seed-stable'};
function fixture({readBackMatches=true}={}){
  const base=createFakeDb({accounts:[{id:account,label:'Fixture',money_limit_cents:10000}]});
  const runs=new Map(),objects=new Map(),records=new Map();
  const provider={writes:[],afterCalls:0};
  const make=(type,prefix,payload,opts)=>{
    if(!opts?.idempotencyKey)throw new TypeError('Missing Stripe idempotency');
    const prior=records.get(opts.idempotencyKey);
    if(prior)return prior;
    const id=prefix+'_FAKE'+(provider.writes.length+1);
    const ob={object:type,id,...payload};
    provider.writes.push({type,id,idempotencyKey:opts.idempotencyKey});
    records.set(opts.idempotencyKey,ob);
    return ob;
  };
  const fetch=(type,id)=>{
    provider.afterCalls++;
    const ob=[...records.values()].find(x=>x.object===type&&x.id===id);
    return {...ob,metadata:readBackMatches?ob.metadata:{bad:'wrong'}};
  };
  const sdk={
    products:{
      create:async(p,o)=>make('product','prod',p,o),
      retrieve:async id=>fetch('product',id)},
    prices:{
      create:async(p,o)=>make('price','price',p,o),
      retrieve:async id=>fetch('price',id)},
    customers:{
      create:async(p,o)=>make('customer','cus',p,o),
      retrieve:async id=>fetch('customer',id)}
  };
  const db={
    ...base,
    async getDevRun({account:a,requestKey}){
      return runs.get(a+':'+requestKey)??null;
    },
    async ensureDevRun({id,account:a,requestKey,scenario,size,planDigest,connection}){
      let r=await this.getDevRun({account:a,requestKey});
      if(!r){
        r={id,request_key:requestKey,stripe_account:a,
          scenario,size,plan_digest:planDigest,connection,
          status:'running',created_at:new Date()};
        runs.set(a+':'+requestKey,r);
      }else if(r.id!==id||r.plan_digest!==planDigest)
        throw new Error('Immutable plan conflict');
      return r;
    },
    async getDevRunObjects({account:a,id}){
      const r=[...runs.values()].find(x=>x.id===id&&x.stripe_account===a);
      return r?(objects.get(r.id)??[]):[];
    },
    async recordDevRunObject({account:a,id,stepName,objectType,objectId}){
      const r=[...runs.values()].find(x=>x.id===id&&x.stripe_account===a);
      if(!r)return false;
      const ob=objects.get(id)??[];
      if(ob.some(x=>x.step_name===stepName||x.object_id===objectId))return false;
      ob.push({step_name:stepName,object_type:objectType,
        object_id:objectId,cleaned:false});
      objects.set(id,ob);return true;
    },
    async completeDevRun({account:a,id,expectedSteps}){
      const r=[...runs.values()].find(x=>x.id===id&&x.stripe_account===a);
      if(!r||(objects.get(id)??[]).length!==expectedSteps)return false;
      r.status='completed';r.completed_at=new Date();return true;
    },
    async listDevRuns({account:a,limit=20,offset=0}){
      return [...runs.values()].filter(x=>x.stripe_account===a)
        .slice(offset,offset+limit).map(x=>({
          ...x,object_count:(objects.get(x.id)??[]).length}));
    }
  };
  const ctx={db,connectionId:'agent-fixture',
    connection:{stripeAccount:account,mode:'test',profile:'full'},
    services:{stripeForConnection:async()=>sdk}};
  return {db,ctx,provider,runs,objects,sdk};
}
describe('V-1a dev_seed actual guarded handler: seven-case contract',()=>{
  it('1. dryRun previews each catalog record without provider or DB writes',async()=>{
    const f=fixture(),result=parse(await makeDevSeedWrite().handler({...req,dryRun:true},f.ctx));
    expect(result.done).toBe(false);
    expect(result.preview).toContain('TEST MODE');
    expect(result.preview).toContain('3 records');
    expect(f.provider.writes).toHaveLength(0);
    expect(f.runs.size).toBe(0);
    expect((await f.db.listAuditForTest())[0].dry_run).toBe(true);
  });
  it('2. missing confirmation never touches Stripe or creates a run',async()=>{
    const f=fixture(),result=parse(await makeDevSeedWrite().handler(req,f.ctx));
    expect(result.needsConfirmation).toBe(true);
    expect(f.provider.writes).toHaveLength(0);
    expect(f.runs.size).toBe(0);
  });
  it('3. confirmed run writes 3 unique idempotent objects, independently verifies each, and replay creates zero',async()=>{
    const f=fixture(),op=makeDevSeedWrite();
    const result=parse(await op.handler({...req,confirm:true},f.ctx));
    expect(result.done).toBe(true);
    expect(result.resourceId).toMatch(/^run_[a-f0-9]{24}$/);
    expect(f.provider.writes.map(x=>x.type)).toEqual(['product','price','customer']);
    expect(new Set(f.provider.writes.map(x=>x.idempotencyKey)).size).toBe(3);
    expect(f.provider.afterCalls).toBe(3);
    expect((await f.db.listDevRuns({account}))[0].status).toBe('completed');
    expect((await f.db.getDevRunObjects({account,id:[...f.runs.values()][0].id}))).toHaveLength(3);
    const replay=parse(await op.handler({...req,confirm:true},f.ctx));
    expect(replay.done).toBe(true);
    expect(f.provider.writes).toHaveLength(3);
    expect((await f.db.listAuditForTest()).length).toBeGreaterThanOrEqual(3);
  });
  it('4. failed provider metadata read-back cannot confirm a completed run',async()=>{
    const f=fixture({readBackMatches:false});
    const result=parse(await makeDevSeedWrite().handler({...req,confirm:true},f.ctx));
    expect(result.done).toBe(false);
    expect(result.resourceId).toBeUndefined();
    expect(f.provider.writes.length).toBeGreaterThan(0);
    expect((await f.db.listDevRuns({account}))[0].status).toBe('running');
    expect((await f.db.getDevRunObjects({account,id:[...f.runs.values()][0].id}))).toHaveLength(0);
  });
  it('5. caller cannot create protected app-owned metadata through seeding',async()=>{
    const f=fixture();
    await expect(makeDevSeedWrite().handler({
      ...req,metadata:{agreementId:'ag_FOREIGN'},confirm:true
    },f.ctx)).rejects.toThrow(/Unsupported seed argument/);
    expect(f.provider.writes).toHaveLength(0);
  });
  it('6. live-mode requests are refused even when fully confirmed',async()=>{
    const f=fixture();
    const r=parse(await handlers.dev_seed({...req,confirm:true},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}}));
    expect(r.done).toBe(false);
    expect(f.provider.writes).toHaveLength(0);
    const listing=parse(await handlers.dev_list_runs({},{
      ...f.ctx,connection:{...f.ctx.connection,mode:'live'}}));
    expect(listing.done).toBe(false);
  });
  it('7. immutable requestKey plan, account isolation and unrelated money cap are enforced',async()=>{
    const f=fixture(),op=makeDevSeedWrite();
    expect(parse(await op.handler({...req,confirm:true},f.ctx)).done).toBe(true);
    await expect(op.handler({...req,size:2,confirm:true},f.ctx))
      .rejects.toThrow(/immutable plan/i);
    const a=parse(await handlers.dev_list_runs({},f.ctx));
    expect(a.runs).toHaveLength(1);
    expect(a.runs[0].objectCount).toBe(3);
    const b=parse(await handlers.dev_list_runs({},{
      ...f.ctx,connection:{...f.ctx.connection,stripeAccount:'acct_OTHER'}
    }));
    expect(b.runs).toHaveLength(0);
    expect((await f.db.getMoneyUsage({account,connection:f.ctx.connectionId})).used_cents).toBe(0);
    expect(f.provider.writes).toHaveLength(3);
  });
});
