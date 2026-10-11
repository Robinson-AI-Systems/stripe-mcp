// Durable TEST cleanup: never guess IDs, initiate refunds, or infer deletions.
import {APP_METADATA_KEYS} from '../tools/app-guard.js';
const prefixes={product:'prod',price:'price',customer:'cus',subscription:'sub',
  invoice:'in',payment_intent:'pi',refund:'re',test_clock:'clock',
  connected_account:'acct'};
const order={subscription:0,invoice:1,payment_intent:2,customer:3,price:4,
  product:5,refund:6,connected_account:7,test_clock:8};
const types={product:'product',price:'price',customer:'customer',
  subscription:'subscription',invoice:'invoice',payment_intent:'payment_intent',
  refund:'refund',connected_account:'account',test_clock:'test_helpers.test_clock'};
const valid=(value,prefix)=>typeof value==='string'&&
  new RegExp('^'+prefix+'_[A-Za-z0-9]{2,100}$').test(value);
const fail=x=>{throw new TypeError(x);};
const maps={product:'products',price:'prices',customer:'customers',
  subscription:'subscriptions',invoice:'invoices',payment_intent:'paymentIntents',
  refund:'refunds',connected_account:'accounts'};
const fetch=async(s,row)=>row.object_type==='test_clock'?
  s.testHelpers.testClocks.retrieve(row.object_id):
  s[maps[row.object_type]].retrieve(row.object_id);
export async function prepareCleanup(a,ctx){
  const account=ctx?.connection?.stripeAccount,db=ctx?.db;
  if(ctx?.connection?.mode!=='test'||!valid(account,'acct'))
    fail('Selected TEST Stripe account required');
  if(!db||!['getDevRunById','getDevRunObjects','markDevRunObjectCleaned']
    .every(x=>typeof db[x]==='function'))
    fail('Durable account-scoped cleanup ledger unavailable');
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['runId','scope','dryRun','confirm','requestKey']
      .includes(k))||(a.runId===undefined)===(a.scope===undefined))
    fail('Specify exactly one runId or scope=all-runs');
  if(a.scope!==undefined&&a.scope!=='all-runs')fail('Invalid cleanup scope');
  if(a.runId!==undefined&&!/^run_[a-f0-9]{24}$/.test(a.runId))
    fail('Invalid run ID');
  let ids;
  if(a.runId)ids=[a.runId];
  else{
    if(typeof db.listDevRuns!=='function')fail('Account run listing unavailable');
    const all=await db.listDevRuns({account,limit:50,offset:0});
    if(!Array.isArray(all)||all.length>=50)
      fail('Too many runs for bounded all-runs cleanup; choose a runId');
    ids=all.map(x=>x.id);
  }
  const runs=[];
  for(const id of ids){
    const run=await db.getDevRunById({account,id});
    if(!run||run.stripe_account!==account||run.id!==id||
      !['running','completed','uncertain'].includes(run.status))
      fail('Run is not owned by selected TEST account');
    const rows=await db.getDevRunObjects({account,id});
    if(!Array.isArray(rows)||rows.length>50)fail('Invalid run ledger size');
    for(const row of rows){
      if(!prefixes[row.object_type]||
        !valid(row.object_id,prefixes[row.object_type])||
        typeof row.step_name!=='string'||typeof row.cleaned!=='boolean')
        fail('Invalid tracked TEST provider identity');
    }
    rows.sort((x,y)=>order[x.object_type]-order[y.object_type]||
      x.step_name.localeCompare(y.step_name));
    runs.push({run,rows});
  }
  const count=runs.reduce((n,x)=>n+x.rows.filter(y=>!y.cleaned).length,0);
  if(count>35)fail('Choose individual runId for more than 35 objects');
  return {account,runs,count};
}
export function verifyCleanupIdentity(run,row,obj){
  const type=row.object_type;
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||
    obj.id!==row.object_id||obj.livemode===true||
    (obj.object!==types[type]&&!(type==='customer'&&obj.deleted===true))||
    Object.keys(obj.metadata??{}).some(k=>APP_METADATA_KEYS.includes(k)))
    fail('Provider ownership or type changed; all TEST cleanup aborted');
  if(type==='test_clock'){
    if(obj.name!=='RTC DEV RUN '+run.id+' '+row.step_name.split('_').at(-1))
      fail('Clock does not match immutable run provenance');
  }else if(!(type==='customer'&&obj.deleted===true)&&
    obj.metadata?.rtc_run!==run.id)
    fail('Provider rtc_run ownership differs from recorded TEST run');
}
async function safeOperation(s,row,was,key){
  const opts={idempotencyKey:key},id=row.object_id;
  switch(row.object_type){
    case 'subscription':
      if(was.status==='canceled')return true;
      if(!['active','trialing','past_due','unpaid','incomplete']
        .includes(was.status))return false;
      await s.subscriptions.cancel(id,{invoice_now:false,prorate:false},opts);
      return (await s.subscriptions.retrieve(id)).status==='canceled';
    case 'invoice':
      if(was.status==='void'||was.deleted===true)return true;
      if(was.status==='paid')return false; // immutable payment evidence
      if(was.status==='open'){
        await s.invoices.voidInvoice(id,{},opts);
        return (await s.invoices.retrieve(id)).status==='void';
      }
      if(was.status==='draft'){
        await s.invoices.del(id,opts);
        return (await s.invoices.retrieve(id)).deleted===true;
      }
      return false;
    case 'payment_intent':
      if(was.status==='canceled')return true;
      if(!['requires_confirmation','requires_payment_method','requires_action']
        .includes(was.status))return false; // processing/succeeded immutable
      await s.paymentIntents.cancel(id,{},opts);
      return (await s.paymentIntents.retrieve(id)).status==='canceled';
    case 'customer':
      if(was.deleted===true)return true;
      await s.customers.del(id,opts);
      return (await s.customers.retrieve(id)).deleted===true;
    case 'price':
    case 'product':{
      if(was.active===false)return true;
      await s[maps[row.object_type]].update(id,{active:false},opts);
      return (await s[maps[row.object_type]].retrieve(id)).active===false;
    }
    // A refund is legally immutable. Connected accounts/test clocks may have
    // dependents and require the separate V-2b risk-reviewed deletion paths.
    case 'refund':case 'connected_account':case 'test_clock':return false;
    default:fail('Unrecognized cleanup type');
  }
}
export async function executeCleanup(a,ctx,s,key){
  const {runs,account}=await prepareCleanup(a,ctx);
  const before=new Map();
  // Globally preflight provenance before mutating even the FIRST record.
  for(const {run,rows} of runs)for(const row of rows.filter(r=>!r.cleaned)){
    const object=await fetch(s,row);
    verifyCleanupIdentity(run,row,object);
    before.set(run.id+':'+row.step_name,object);
  }
  const outcomes=[];
  for(const {run,rows} of runs)for(const row of rows){
    if(row.cleaned){
      outcomes.push({runId:run.id,step:row.step_name,id:row.object_id,
        status:'already_cleaned'});continue;
    }
    let state='retained';
    try{
      const worked=await safeOperation(s,row,
        before.get(run.id+':'+row.step_name),key+'_'+run.id+'_'+row.step_name);
      if(worked){
        state=await ctx.db.markDevRunObjectCleaned({account,id:run.id,
          stepName:row.step_name,objectType:row.object_type,objectId:row.object_id})?
          'cleaned':'uncertain';
      }
    }catch{state='uncertain';}
    outcomes.push({runId:run.id,step:row.step_name,id:row.object_id,
      status:state});
  }
  // Database read-back is independent of the cleanup write/mark requests.
  for(const {run} of runs){
    const rows=await ctx.db.getDevRunObjects({account,id:run.id});
    for(const o of outcomes.filter(x=>x.runId===run.id&&x.status==='cleaned')){
      if(!rows.some(r=>r.step_name===o.step&&r.object_id===o.id&&r.cleaned===true))
        o.status='uncertain';
    }
  }
  return {outcomes,allCleaned:outcomes.every(o=>
    ['cleaned','already_cleaned'].includes(o.status))};
}
