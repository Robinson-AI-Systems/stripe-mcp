// V-1b1 actual-handler multi-step catalog/payment/subscription TEST regressions.
import {describe,it,expect} from 'vitest';
import {makeDevSeedWrite} from '../../src/tools/dev-seed.js';
import {planSeed} from '../../src/dev/scenarios.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const account='acct_safefixture';
const parse=result=>JSON.parse(result.content[0].text);
const request=(scenario,key='expanded')=>({scenario,size:1,requestKey:key});
function fixture({mismatch=false}={}){
  const base=createFakeDb({accounts:[{id:account,label:'Test',money_limit_cents:50000}]});
  const runMap=new Map(),objects=new Map(),resources=new Map(),ids=new Map();
  const calls=[];
  function add(type,prefix,fields,opts){
    if(!opts?.idempotencyKey)throw Error('Idempotency is mandatory');
    if(ids.has(opts.idempotencyKey))return ids.get(opts.idempotencyKey);
    const id=prefix+'_FAKE'+(calls.length+1);
    const result={id,object:type,...fields};
    calls.push({action:'create',type,params:fields,opts});
    ids.set(opts.idempotencyKey,result);resources.set(id,result);
    return result;
  }
  const get=id=>{
    const x=resources.get(id);
    if(!x)throw Error('Unexpected provider ID '+id);
    if(mismatch&&x.object==='payment_intent')return {...x,amount_received:1};
    return x;
  };
  const sdk={
    products:{
      create:async(p,o)=>add('product','prod',p,o),
      retrieve:async id=>get(id)
    },
    prices:{
      create:async(p,o)=>add('price','price',{
        ...p,type:p.recurring?'recurring':'one_time'},o),
      retrieve:async id=>get(id)
    },
    customers:{
      create:async(p,o)=>add('customer','cus',p,o),
      retrieve:async id=>get(id)
    },
    paymentIntents:{
      create:async(p,o)=>add('payment_intent','pi',{
        ...p,status:'succeeded',amount_received:p.amount},o),
      retrieve:async id=>get(id)
    },
    subscriptions:{
      create:async(p,o)=>add('subscription','sub',{
        ...p,status:'trialing',items:{data:[{price:p.items[0].price}]}
      },o),
      retrieve:async id=>get(id),
      cancel:async(id,p,o)=>{
        if(!o?.idempotencyKey)throw Error('Subscription cancellation not idempotent');
        calls.push({action:'cancel',id,p});
        resources.set(id,{...get(id),status:'canceled'});
        return get(id);
      }
    }
  };
  const db={
    ...base,
    async getDevRun({account:a,requestKey:k}){return runMap.get(a+':'+k)??null;},
    async ensureDevRun({id,account:a,requestKey:k,scenario,size,planDigest,connection}){
      const key=a+':'+k;
      if(!runMap.has(key))runMap.set(key,{id,request_key:k,stripe_account:a,
        scenario,size,plan_digest:planDigest,connection,status:'running',
        created_at:new Date()});
      const r=runMap.get(key);
      if(r.id!==id||r.scenario!==scenario||r.plan_digest!==planDigest)
        throw Error('Immutable seed plan changed');
      return r;
    },
    async getDevRunObjects({account:a,id}){
      const found=[...runMap.values()].find(x=>x.id===id&&x.stripe_account===a);
      return found?objects.get(id)??[]:[];
    },
    async recordDevRunObject({account:a,id,stepName,objectType,objectId}){
      const run=[...runMap.values()].find(x=>x.id===id&&x.stripe_account===a);
      if(!run)return false;
      const list=objects.get(id)??[];
      if(list.some(x=>x.step_name===stepName))return false;
      list.push({step_name:stepName,object_type:objectType,
        object_id:objectId,cleaned:false});
      objects.set(id,list);return true;
    },
    async completeDevRun({account:a,id,expectedSteps}){
      const run=[...runMap.values()].find(x=>x.id===id&&x.stripe_account===a);
      if(!run||(objects.get(id)?.length??0)!==expectedSteps)return false;
      run.status='completed';return true;
    }
  };
  const ctx={connection:{stripeAccount:account,mode:'test',profile:'full'},
    connectionId:'test-connection',db,services:{stripeForConnection:async()=>sdk}};
  return {ctx,sdk,db,runMap,objects,resources,calls};
}
describe('V-1b1 scoped realistic TEST seed scenarios',()=>{
  it('keeps existing catalog starter immutable plan digest compatible',()=>{
    const p=planSeed(request('catalog-starter'),account);
    const steps=[
      {name:'product_1',type:'product',label:'RTC Test Product 1',amountCents:3600},
      {name:'price_1',type:'price',label:'Monthly TEST price 1',amountCents:3600},
      {name:'customer_1',type:'customer',label:'RTC Test Customer 1'}
    ];
    expect(p.steps).toEqual(steps);
  });
  it('basic-store confirms a synthetic incoming TEST card charge and exact ledger',async()=>{
    const f=fixture(),op=makeDevSeedWrite();
    const a=request('basic-store');
    const preview=parse(await op.handler({...a,dryRun:true},f.ctx));
    expect(preview.preview).toContain('$36.00');
    expect(f.calls).toHaveLength(0);
    expect(parse(await op.handler({...a,confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls.map(x=>x.type)).toEqual([
      'product','price','customer','payment_intent']);
    expect(f.calls[3].params.payment_method).toBe('pm_card_visa');
    expect(f.calls[3].params.amount).toBe(3600);
    const run=[...f.runMap.values()][0];
    expect(run.status).toBe('completed');
    expect((await f.db.getDevRunObjects({account,id:run.id})).map(x=>x.object_type))
      .toEqual(['product','price','customer','payment_intent']);
    expect(parse(await op.handler({...a,confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls).toHaveLength(4);
    expect((await f.db.getMoneyUsage({account,connection:f.ctx.connectionId})).used_cents).toBe(0);
  });
  it('trial subscription is created without collecting an immediate payment',async()=>{
    const f=fixture(),a=request('subscription-trial');
    expect(parse(await makeDevSeedWrite().handler({...a,confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls.map(x=>x.type)).toEqual([
      'product','price','customer','subscription']);
    expect(f.calls[3].params.trial_period_days).toBe(7);
    expect(f.calls.some(x=>x.type==='payment_intent')).toBe(false);
  });
  it('canceled trial subscription uses native cancellation, records only verified final state',async()=>{
    const f=fixture(),a=request('subscription-canceled');
    expect(parse(await makeDevSeedWrite().handler({...a,confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls.at(-1).action).toBe('cancel');
    const sub=[...f.resources.values()].find(x=>x.object==='subscription');
    expect(sub.status).toBe('canceled');
    const count=f.calls.length;
    expect(parse(await makeDevSeedWrite().handler({...a,confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls).toHaveLength(count);
  });
  it('descriptions select one known safe scenario; rejects ambiguous or refund scenarios',()=>{
    expect(planSeed({description:'a simple one-time store sale',size:1,requestKey:'plain'},account)
      .scenario).toBe('basic-store');
    expect(()=>planSeed({description:'give a customer a test refund',
      size:1,requestKey:'refund'},account)).toThrow(/next consent-aware/);
    expect(()=>planSeed({description:'catalog and trial subscriptions',
      size:1,requestKey:'ambiguous'},account)).toThrow(/ambiguous/);
  });
  it('fails closed if a payment appears successful but provider amount differs',async()=>{
    const f=fixture({mismatch:true});
    const res=parse(await makeDevSeedWrite().handler({
      ...request('basic-store'),confirm:true},f.ctx));
    expect(res.done).toBe(false);
    expect([...f.runMap.values()][0].status).toBe('running');
    expect((await f.db.getDevRunObjects({account,
      id:[...f.runMap.values()][0].id})).length).toBe(3);
  });
});
