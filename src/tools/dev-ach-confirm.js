// Confirm only run-owned, previously unconfirmed synthetic TEST ACH payments.
// A Stripe provider state transition is not proof of bank settlement.
import {defineWrite,gone} from './write.js';
import {client,ref,writeProfiles,validateFields} from './billing-shared.js';
const runId={type:'string',pattern:'^run_[a-f0-9]{24}$'};
const paymentStep={type:'string',pattern:'^payment_[1-5]$'};
const fields={runId,paymentStep};
const id=(v,p)=>typeof v==='string'&&new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(v);
const fail=x=>{throw new TypeError(x);};
const amount=n=>Number.isSafeInteger(n)&&n>0&&n<=100000000;
async function preflight(a,ctx){
  if(ctx?.connection?.mode!=='test'||!id(ctx.connection.stripeAccount,'acct'))
    fail('Only a selected TEST account can initiate synthetic ACH');
  const db=ctx.db;
  if(typeof db?.getDevRunById!=='function'||
    typeof db?.getDevRunObjects!=='function')
    fail('Durable TEST seed ledger is unavailable');
  const account=ctx.connection.stripeAccount;
  const run=await db.getDevRunById({account,id:a.runId});
  if(!run||run.id!==a.runId||run.stripe_account!==account||
    run.status!=='completed'||run.scenario!=='ach-awaiting-confirmation'||
    !Number.isInteger(run.size)||run.size<1||run.size>5)
    fail('Completed account-scoped synthetic TEST ACH seed run required');
  const n=Number(a.paymentStep.split('_')[1]);
  if(n>run.size)fail('Requested ACH step is outside this run');
  const rows=await db.getDevRunObjects({account,id:run.id});
  const item=rows.find(x=>x.step_name===a.paymentStep&&
    x.object_type==='payment_intent'&&x.cleaned===false);
  const customer=rows.find(x=>x.step_name==='customer_'+n&&
    x.object_type==='customer'&&x.cleaned===false);
  if(!item||!id(item.object_id,'pi')||!customer||
    !id(customer.object_id,'cus'))
    fail('Run-owned TEST payment/customer IDs could not be verified');
  const s=await client(ctx);
  const p=await s.paymentIntents.retrieve(item.object_id);
  if(p?.object!=='payment_intent'||p.id!==item.object_id||
    p.livemode===true||p.metadata?.rtc_run!==run.id||
    ref(p.customer)!==customer.object_id||p.currency!=='usd'||
    !amount(p.amount)||p.amount!==3500+100*n||
    p.amount_received!==0||!['requires_confirmation','requires_payment_method'].includes(p.status)||
    !p.payment_method_types?.includes('us_bank_account')||
    ref(p.payment_method)!=='pm_usBankAccount')
    fail('Provider TEST ACH payment is not an eligible unconfirmed run-owned intent');
  return {...p,_runId:run.id,_step:a.paymentStep,_customerId:customer.object_id};
}
const afterMatches=(b,a)=>a?.object==='payment_intent'&&a.id===b.id&&
  a.livemode===false&&a.metadata?.rtc_run===b._runId&&
  ref(a.customer)===b._customerId&&a.currency==='usd'&&
  a.amount===b.amount&&a.payment_method_types?.includes('us_bank_account')&&
  ref(a.payment_method)==='pm_usBankAccount'&&
  (['processing','requires_action'].includes(a.status)?
    a.amount_received===0:
    a.status==='succeeded'&&a.amount_received===b.amount);
export function makeDevSeedAchConfirmWrite(){
  let acknowledged=false;
  const op=defineWrite({
    name:'dev_confirm_seed_ach',
    read:async(a,ctx)=>{
      validateFields(a,fields,['runId','paymentStep']);
      return preflight(a,ctx);
    },
    summarize:b=>'TEST MODE. Initiate ONE synthetic bank-account TEST charge for '+b.id+
      ', run '+b._runId+', '+b._step+', amount $'+(b.amount/100).toFixed(2)+
      ' USD. Use only Stripe test payment method pm_usBankAccount. '+ 
      'The synthetic TEST mandate has no live consumer; confirmation may be '+ 
      'requires_action or processing. This never proves actual ACH settlement.',
    money:async(_a,_ctx,b)=>({amountCents:b.amount,currency:'usd',direction:'in',
      targetId:b.id,description:'Synthetic incoming TEST bank-account charge initiation'}),
    apply:async(_a,ctx,{before,idempotencyKey})=>{
      const s=await client(ctx);
      const p=await s.paymentIntents.confirm(before.id,{
        payment_method:'pm_usBankAccount',
        mandate_data:{customer_acceptance:{type:'online',
          online:{ip_address:'127.0.0.1',
            user_agent:'RTC Stripe MCP synthetic TEST-only bank acceptance'}}}
      },{idempotencyKey});
      if(p?.object!=='payment_intent'||p.id!==before.id||p.livemode===true||
        !['processing','requires_action','succeeded'].includes(p.status))
        fail('Stripe did not acknowledge expected synthetic TEST ACH confirmation');
      acknowledged=true;
    },
    readAfter:async(a,ctx)=>{
      if(!acknowledged)return null;
      const run=await ctx.db.getDevRunById({
        account:ctx.connection.stripeAccount,id:a.runId});
      if(!run||run.status!=='completed'||run.scenario!=='ach-awaiting-confirmation')
        fail('Account-scoped TEST ACH run changed during provider confirmation');
      const rows=await ctx.db.getDevRunObjects({
        account:ctx.connection.stripeAccount,id:a.runId});
      const row=rows.find(x=>x.step_name===a.paymentStep&&
        x.object_type==='payment_intent'&&x.cleaned===false);
      if(!row||!id(row.object_id,'pi'))fail('Original run payment lost');
      const s=await client(ctx);
      return s.paymentIntents.retrieve(row.object_id);
    },
    verify:(b,after)=>afterMatches(b,after)
  });
  return {...op,handler:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Synthetic ACH confirmation requires TEST mode'):op.handler(a,ctx)};
}
export const tools=[(()=>{
  const op=makeDevSeedAchConfirmWrite();
  return {...op.tool,area:'developer',profiles:writeProfiles,
    description:'Initiate one recorded synthetic TEST ACH intent and verify processing state; does not prove settlement.',
    inputSchema:{type:'object',properties:{...fields,
      confirm:{type:'boolean'},dryRun:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:['runId','paymentStep'],additionalProperties:false}};
})()];
export const handlers={
  dev_confirm_seed_ach:async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test')return gone('TEST mode required');
    const s=await client(ctx);
    return makeDevSeedAchConfirmWrite().handler(a,{
      ...ctx,getCustomer:id=>s.customers.retrieve(id)});
  }
};
