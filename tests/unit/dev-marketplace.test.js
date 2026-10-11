import {describe,it,expect} from 'vitest';
import {makeDevSeedWrite} from '../../src/tools/dev-seed.js';
import {handlers} from '../../src/tools/dev-connect.js';
import {verifyConnectReadiness} from '../../src/dev/marketplace.js';
import {planSeed} from '../../src/dev/scenarios.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const account='acct_FAKEPLATFORM',parse=r=>JSON.parse(r.content[0].text);
const a={scenario:'marketplace-onboarding',size:1,requestKey:'connect-seller-one'};
function fixture({connect=true,platform=account,foreign=false,missingCapability=false}={}){
  const base=createFakeDb({accounts:[{id:account,label:'Test'}]});
  const runs=new Map(),records=new Map(),objects=new Map(),keys=new Map(),calls=[];
  const existing=id=>{
    if(!objects.has(id))throw new TypeError('Unexpected provider ID '+id);
    return {...objects.get(id)};
  };
  const create=(kind,prefix,payload,opts)=>{
    if(!opts?.idempotencyKey)throw Error('Missing Stripe idempotency');
    if(keys.has(opts.idempotencyKey))return keys.get(opts.idempotencyKey);
    const id=prefix+'_FAKE'+(calls.length+1);
    const obj={id,object:kind,livemode:false,...payload};
    calls.push({op:'create',kind,id,payload,opts});
    objects.set(id,obj);keys.set(opts.idempotencyKey,obj);return obj;
  };
  const sdk={
    accounts:{
      retrieve:async id=>id?existing(id):{
        id:platform,object:'account',livemode:false,
        capabilities:{transfers:'active'}
      },
      list:async params=>{
        calls.push({op:'list',params});
        if(!connect)throw new TypeError('Connect unavailable');
        return {object:'list',data:[],has_more:false};
      },
      create:async(p,o)=>create('account','acct',{
        ...p,capabilities:{transfers:missingCapability?undefined:'pending'},
        ...(foreign?{metadata:{rtc_run:'run_not_owner'}}:{})
      },o)
    },
    products:{
      create:async(p,o)=>create('product','prod',p,o),
      retrieve:async id=>existing(id)
    },
    prices:{
      create:async(p,o)=>create('price','price',{...p,type:'one_time'},o),
      retrieve:async id=>existing(id)
    },
    customers:{
      create:async(p,o)=>create('customer','cus',p,o),
      retrieve:async id=>existing(id)
    }
  };
  const db={
    ...base,
    async getDevRun({account:a,requestKey:k}){return runs.get(a+':'+k)??null;},
    async ensureDevRun({id,account:a,requestKey,scenario,size,planDigest,connection}){
      const key=a+':'+requestKey;
      if(!runs.has(key))runs.set(key,{id,request_key:requestKey,stripe_account:a,
        scenario,size,plan_digest:planDigest,connection,status:'running',
        created_at:new Date()});
      const r=runs.get(key);
      if(r.id!==id||r.plan_digest!==planDigest)throw Error('Plan changed');
      return r;
    },
    async getDevRunObjects({account:a,id}){
      return [...runs.values()].some(r=>r.id===id&&r.stripe_account===a)?
        records.get(id)??[]:[];
    },
    async recordDevRunObject({account:a,id,stepName,objectType,objectId}){
      if(![...runs.values()].some(r=>r.id===id&&r.stripe_account===a))
        return false;
      const rows=records.get(id)??[];
      if(rows.some(x=>x.step_name===stepName||x.object_id===objectId))return false;
      rows.push({step_name:stepName,object_type:objectType,
        object_id:objectId,cleaned:false});
      records.set(id,rows);return true;
    },
    async completeDevRun({account:a,id,expectedSteps}){
      const run=[...runs.values()].find(r=>r.id===id&&r.stripe_account===a);
      if(!run||(records.get(id)?.length??0)!==expectedSteps)return false;
      run.status='completed';return true;
    }
  };
  const ctx={connection:{stripeAccount:account,mode:'test',profile:'full'},
    connectionId:'connect-fixture',db,services:{stripeForConnection:async()=>sdk}};
  return {ctx,sdk,calls,runs,records,objects,db};
}
describe('V-1b4f Connect-gated TEST marketplace',()=>{
  it('selects the explicit onboarding scenario without changing older run plans',()=>{
    const p=planSeed(a,account);
    expect(p.steps.map(s=>s.name)).toEqual(['product_1','price_1',
      'customer_1','connected_account_1']);
    expect(p.amountCents).toBe(0);
    expect(planSeed({scenario:'catalog-starter',size:1,requestKey:'other'},account)
      .steps).toHaveLength(3);
    expect(planSeed({description:'marketplace',size:1,requestKey:'intro'},account)
      .scenario).toBe('marketplace-onboarding');
    expect(()=>planSeed({description:'marketplace payout',size:1,
      requestKey:'deny'},account)).toThrow(/transfers or payment/);
  });
  it('readiness returns independently verified TEST Connect access, never transfer eligibility',async()=>{
    const f=fixture();
    const info=parse(await handlers.dev_connect_readiness({},f.ctx));
    expect(info).toMatchObject({connectAccessVerified:true,mode:'test',
      platformTransferCapability:'active'});
    expect(info.note).toContain('NOT transfer or payout');
    expect(f.calls.map(x=>x.op)).toEqual(['list']);
    expect(await verifyConnectReadiness(f.sdk,account)).toMatchObject({
      platformAccount:account,connectAccessVerified:true
    });
  });
  it('preview does not send Stripe writes or create a run',async()=>{
    const f=fixture();
    const v=parse(await makeDevSeedWrite().handler({...a,dryRun:true},f.ctx));
    expect(v.preview).toContain('no charges');
    expect(v.preview).toContain('NOT complete');
    expect(f.calls.filter(x=>x.op==='create')).toHaveLength(0);
    expect(f.runs.size).toBe(0);
  });
  it('creates four verified TEST records and replays without duplicate provider writes',async()=>{
    const f=fixture(),op=makeDevSeedWrite();
    const out=parse(await op.handler({...a,confirm:true},f.ctx));
    expect(out.done).toBe(true);
    expect(f.calls.filter(x=>x.op==='create').map(x=>x.kind))
      .toEqual(['product','price','customer','account']);
    const run=[...f.runs.values()][0];
    const rows=await f.db.getDevRunObjects({account,id:run.id});
    expect(rows.map(x=>x.object_type)).toEqual([
      'product','price','customer','connected_account']);
    const seller=f.objects.get(rows.at(-1).object_id);
    expect(seller).toMatchObject({type:'express',country:'US',
      metadata:{rtc_run:run.id},capabilities:{transfers:'pending'}});
    expect(f.calls.filter(x=>/charge|transfer|payout/.test(x.op))).toHaveLength(0);
    const count=f.calls.filter(x=>x.op==='create').length;
    expect(parse(await op.handler({...a,confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls.filter(x=>x.op==='create')).toHaveLength(count);
  });
  it('preflight refuses absent Connect access before any new Stripe fixture',async()=>{
    const f=fixture({connect:false});
    const v=parse(await makeDevSeedWrite().handler({...a,confirm:true},f.ctx));
    expect(v.done).toBe(false);
    expect(f.calls.filter(x=>x.op==='create')).toHaveLength(0);
  });
  it('platform account mismatch rejects Connect before writes',async()=>{
    const f=fixture({platform:'acct_DIFFERENT'});
    const v=parse(await makeDevSeedWrite().handler({...a,confirm:true},f.ctx));
    expect(v.done).toBe(false);
    expect(f.calls).toHaveLength(0);
  });
  it('foreign rtc_run tag and missing transfer capability cannot complete run',async()=>{
    for(const opts of [{foreign:true},{missingCapability:true}]){
      const f=fixture(opts);
      const v=parse(await makeDevSeedWrite().handler({...a,confirm:true},f.ctx));
      expect(v.done).toBe(false);
      expect([...f.runs.values()][0].status).toBe('running');
      expect((await f.db.getDevRunObjects({account,
        id:[...f.runs.values()][0].id})).length)
        .toBe(opts.missingCapability?4:3);
      // A real provider account already exists when its capability cannot be
      // validated. Preserve its ID for V-2 cleanup rather than orphan it.
    }
  });
  it('LIVE and read_only refuse all developer Connect mutations',async()=>{
    for(const connection of [{mode:'live'},{profile:'read_only'}]){
      const f=fixture();
      Object.assign(f.ctx.connection,connection);
      const v=parse(await makeDevSeedWrite().handler({...a,confirm:true},f.ctx));
      expect(v.done).toBe(false);
      expect(f.calls).toHaveLength(0);
      expect(f.runs.size).toBe(0);
    }
  });
  it('readiness denies LIVE and unexpected arguments',async()=>{
    const f=fixture();
    expect((await handlers.dev_connect_readiness({runId:'oops'},f.ctx)).isError)
      .toBe(true);
    f.ctx.connection.mode='live';
    expect((await handlers.dev_connect_readiness({},f.ctx)).isError).toBe(true);
    expect(f.calls).toHaveLength(0);
  });
});
