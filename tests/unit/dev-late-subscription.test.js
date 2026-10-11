// Real-handler clocked failing-renewal regressions; no external Stripe calls.
import {describe,it,expect} from 'vitest';
import {makeDevSeedWrite} from '../../src/tools/dev-seed.js';
import {planSeed} from '../../src/dev/scenarios.js';
import {createFakeDb} from '../../test/helpers/fake-db.js';
const account='acct_safefixture',frozenTime=1700000000;
const parse=x=>JSON.parse(x.content[0].text);
const args=(requestKey='late')=>({
  scenario:'subscription-past-due',size:1,frozenTime,requestKey
});
function fixture({badInvoice=false}={}){
  const base=createFakeDb({accounts:[{id:account,label:'Test',money_limit_cents:50000}]});
  const runMap=new Map(),ledger=new Map(),provider=new Map(),keys=new Map(),calls=[];
  const put=(id,object,other={})=>{
    const v={id,object,livemode:false,...other};provider.set(id,v);return v;
  };
  const get=id=>{
    const x=provider.get(id);
    if(!x)throw Error('No provider object '+id);
    return {...x};
  };
  const created=(kind,id,body,opts)=>{
    if(!opts?.idempotencyKey)throw Error('Stripe idempotency missing');
    if(keys.has(opts.idempotencyKey))return keys.get(opts.idempotencyKey);
    calls.push({kind:'create',object:kind,id,body,opts});
    const v=put(id,kind,body);keys.set(opts.idempotencyKey,v);return v;
  };
  const sdk={
    testHelpers:{testClocks:{
      create:async(b,o)=>created('test_helpers.test_clock','clock_FAKE1',{
        ...b,status:'ready',deletes_after:b.frozen_time+2000000
      },o),
      retrieve:async id=>get(id),
      advance:async(id,b,o)=>{
        if(!o?.idempotencyKey)throw Error('Advance idempotency missing');
        calls.push({kind:'advance',id,body:b,opts:o});
        const x=get(id);put(id,x.object,{...x,status:'advancing',
          status_details:{advancing:{target_frozen_time:b.frozen_time}}});
        return get(id);
      }
    }},
    products:{
      create:async(b,o)=>created('product','prod_FAKE1',b,o),
      retrieve:async id=>get(id)
    },
    prices:{
      create:async(b,o)=>created('price','price_FAKE1',b,o),
      retrieve:async id=>get(id)
    },
    customers:{
      create:async(b,o)=>created('customer','cus_FAKE1',b,o),
      retrieve:async id=>get(id)
    },
    subscriptions:{
      create:async(b,o)=>{
        const v=created('subscription','sub_FAKE1',{
          ...b,status:'trialing',latest_invoice:'in_TRIAL1',
          items:{data:[{price:b.items[0].price}]}
        },o);
        put('in_TRIAL1','invoice',{customer:b.customer,currency:'usd',
          amount_due:0,amount_paid:0,amount_remaining:0,status:'paid',
          metadata:{},attempted:true,attempt_count:0});
        return v;
      },
      retrieve:async id=>get(id)
    },
    invoices:{
      retrieve:async id=>{
        const x=get(id);
        return badInvoice&&id==='in_TRIAL1'?{...x,amount_paid:200}:x;
      },
      update:async(id,body,opts)=>{
        if(!opts?.idempotencyKey)throw Error('Invoice tagging idempotency missing');
        calls.push({kind:'update',id,body,opts});
        const x=get(id);
        put(id,'invoice',{...x,metadata:{...x.metadata,...body.metadata}});
        return get(id);
      }
    }
  };
  const db={
    ...base,
    async getDevRun({account:a,requestKey}){
      return runMap.get(a+':'+requestKey)??null;
    },
    async ensureDevRun({id,account:a,requestKey,scenario,size,planDigest,connection}){
      const key=a+':'+requestKey;
      if(!runMap.has(key))runMap.set(key,{id,stripe_account:a,request_key:requestKey,
        scenario,size,plan_digest:planDigest,connection,status:'running',
        created_at:new Date()});
      const x=runMap.get(key);
      if(x.id!==id||x.plan_digest!==planDigest)throw Error('Immutable plan mismatch');
      return x;
    },
    async getDevRunObjects({account:a,id}){
      return [...runMap.values()].some(x=>x.id===id&&x.stripe_account===a)?
        ledger.get(id)??[]:[];
    },
    async recordDevRunObject({account:a,id,stepName,objectType,objectId}){
      if(![...runMap.values()].some(x=>x.id===id&&x.stripe_account===a))
        return false;
      const list=ledger.get(id)??[];
      if(list.some(x=>x.step_name===stepName||x.object_id===objectId))return false;
      list.push({step_name:stepName,object_type:objectType,
        object_id:objectId,cleaned:false});
      ledger.set(id,list);return true;
    },
    async completeDevRun({account:a,id,expectedSteps}){
      const x=[...runMap.values()].find(x=>x.id===id&&x.stripe_account===a);
      if(!x||(ledger.get(id)?.length??0)!==expectedSteps)return false;
      x.status='completed';return true;
    }
  };
  const ctx={connection:{stripeAccount:account,mode:'test',profile:'full'},
    connectionId:'late-test',db,services:{stripeForConnection:async()=>sdk}};
  function settleClock({paid=false,attempted=true,customer='cus_FAKE1'}={}){
    const clock=get('clock_FAKE1');
    put('clock_FAKE1',clock.object,{...clock,status:'ready',
      frozen_time:frozenTime+8*86400,status_details:{}});
    const sub=get('sub_FAKE1');
    put('sub_FAKE1','subscription',{...sub,status:paid?'active':'past_due',
      latest_invoice:'in_FAILED1'});
    put('in_FAILED1','invoice',{customer,currency:'usd,status:paid?'paid':'open',
      amount_due:3600,amount_remaining:paid?0:3600,amount_paid:paid?3600:0,
      attempted,attempt_count:attempted?1:0,metadata:{}});
  }
  return {ctx,sdk,runMap,ledger,calls,get,put,settleClock};
}
describe('V-1b4d verified TEST past-due subscription run',()=>{
  it('plans immutable full clock/provenance/invoice stages without affecting existing scenarios',()=>{
    const p=planSeed(args(),account);
    expect(p.steps.map(s=>s.name)).toEqual(['clock_1','product_1','price_1',
      'customer_1','subscription_1','trial_invoice_1','failed_invoice_1']);
    expect(p.expectedSteps).toBe(7);
    expect(planSeed({scenario:'catalog-starter',size:1,requestKey:'other'},account)
      .steps).toHaveLength(3);
  });
  it('previews an asynchronous provider-verification workflow, never declares past due upfront',async()=>{
    const f=fixture();
    const v=parse(await makeDevSeedWrite().handler({...args(),dryRun:true},f.ctx));
    expect(v.preview).toContain('only complete');
    expect(v.preview).toContain('asynchronous');
    expect(f.calls).toHaveLength(0);
    expect(f.runMap.size).toBe(0);
  });
  it('creates six verified TEST objects and leaves run running while clock is advancing',async()=>{
    const f=fixture(),op=makeDevSeedWrite();
    const r=parse(await op.handler({...args(),confirm:true},f.ctx));
    expect(r.done).toBe(false);
    const run=[...f.runMap.values()][0];
    expect(run.status).toBe('running');
    expect((await f.ctx.db.getDevRunObjects({account,id:run.id})).map(x=>x.step_name))
      .toEqual(['clock_1','product_1','price_1','customer_1',
        'subscription_1','trial_invoice_1']);
    expect(f.calls.filter(x=>x.kind==='advance')).toHaveLength(1);
    expect(f.get('clock_FAKE1').status).toBe('advancing');
    expect(f.get('cus_FAKE1').test_clock).toBe('clock_FAKE1');
    expect(f.get('cus_FAKE1').invoice_settings.default_payment_method)
      .toBe('pm_card_chargeCustomerFail');
  });
  it('only completes after exact past_due and attempted unpaid renewal invoice are read and recorded',async()=>{
    const f=fixture(),op=makeDevSeedWrite();
    expect(parse(await op.handler({...args(),confirm:true},f.ctx)).done).toBe(false);
    const priorCalls=f.calls.length;
    expect(parse(await op.handler({...args(),confirm:true},f.ctx)).done).toBe(false);
    expect(f.calls).toHaveLength(priorCalls);
    f.settleClock();
    const out=parse(await op.handler({...args(),confirm:true},f.ctx));
    expect(out.done).toBe(true);
    const run=[...f.runMap.values()][0];
    expect(run.status).toBe('completed');
    const rows=await f.ctx.db.getDevRunObjects({account,id:run.id});
    expect(rows).toHaveLength(7);
    expect(rows.at(-1).object_id).toBe('in_FAILED1');
    expect(f.get('in_FAILED1').metadata.rtc_run).toBe(run.id);
    expect(f.calls.filter(x=>x.kind==='advance')).toHaveLength(1);
    const after=f.calls.length;
    expect(parse(await op.handler({...args(),confirm:true},f.ctx)).done).toBe(true);
    expect(f.calls).toHaveLength(after);
  });
  it('cannot falsely classify an actually paid post-trial subscription as past due',async()=>{
    const f=fixture(),op=makeDevSeedWrite();
    await op.handler({...args(),confirm:true},f.ctx);
    f.settleClock({paid:true});
    const r=parse(await op.handler({...args(),confirm:true},f.ctx));
    expect(r.done).toBe(false);
    expect([...f.runMap.values()][0].status).toBe('running');
    expect(f.calls.filter(x=>x.id==='in_FAILED1')).toHaveLength(0);
  });
  it('rejects an unattempted invoice, foreign customer, and mismatched initially paid invoice',async()=>{
    for(const changed of [{attempted:false},{customer:'cus_OTHER1'}]){
      const f=fixture(),op=makeDevSeedWrite();
      await op.handler({...args(),confirm:true},f.ctx);
      f.settleClock(changed);
      const v=parse(await op.handler({...args(),confirm:true},f.ctx));
      expect(v.done).toBe(false);
      expect([...f.runMap.values()][0].status).toBe('running');
    }
    const f=fixture({badInvoice:true});
    const r=parse(await makeDevSeedWrite().handler({...args(),confirm:true},f.ctx));
    expect(r.done).toBe(false);
    expect(f.calls.filter(x=>x.kind==='advance')).toHaveLength(0);
  });
  it('rejects mutable frozen times and unsupported clock data on unrelated scenarios',()=>{
    expect(()=>planSeed({...args(),frozenTime:0},account)).toThrow(/frozenTime/);
    expect(()=>planSeed({...args(),frozenTime:4102444800},account)).toThrow(/frozenTime/);
    expect(()=>planSeed({scenario:'subscription-active',size:1,
      requestKey:'other',frozenTime},account)).toThrow(/Only a clocked/);
  });
  it('refuses LIVE before any provider or ledger write',async()=>{
    const f=fixture();f.ctx.connection.mode='live';
    const r=await makeDevSeedWrite().handler({...args(),confirm:true},f.ctx);
    expect(parse(r).done).toBe(false);
    expect(f.calls).toHaveLength(0);
    expect(f.runMap.size).toBe(0);
  });
});
