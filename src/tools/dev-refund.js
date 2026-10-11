// V-1b2 separately owner-approved refunds for recorded synthetic TEST store charges.
import {defineWrite,gone} from './write.js';
import {client,ref,writeProfiles,validateFields} from './billing-shared.js';
const run={type:'string',pattern:'^run_[a-f0-9]{24}$'};
const step={type:'string',pattern:'^payment_[1-5]$'};
const fields={runId:run,paymentStep:step,outsideApp:{type:'boolean'}};
const checks={id:/^ch_[A-Za-z0-9]{2,100}$/,
  payment:/^pi_[A-Za-z0-9]{2,100}$/};
function valid(n){return Number.isSafeInteger(n)&&n>0&&n<=100000000;}
async function preflight(a,ctx){
  const account=ctx.connection.stripeAccount;
  if(typeof ctx.db?.getDevRunById!=='function'||
    typeof ctx.db?.getDevRunObjects!=='function'||
    typeof ctx.db?.recordDevRunRefund!=='function')
    throw new TypeError('Durable TEST refund ledger is unavailable');
  const run=await ctx.db.getDevRunById({account,id:a.runId});
  if(!run||run.status!=='completed'||run.scenario!=='basic-store')
    throw new TypeError('A completed, tracked TEST basic-store run is required');
  const all=await ctx.db.getDevRunObjects({account,id:a.runId});
  const i=Number(a.paymentStep.split('_')[1]);
  if(i>run.size||all.some(o=>o.step_name==='refund_'+i))
    throw new TypeError('This run has no unrefunded eligible TEST payment step');
  const row=all.find(o=>o.step_name===a.paymentStep&&
    o.object_type==='payment_intent'&&o.cleaned===false);
  const customer=all.find(o=>o.step_name==='customer_'+i&&
    o.object_type==='customer'&&o.cleaned===false);
  if(!row||!checks.payment.test(row.object_id)||!customer||
    !/^cus_[A-Za-z0-9]{2,100}$/.test(customer.object_id))
    throw new TypeError('Original provider payment/customer IDs are not recorded');
  const s=await client(ctx);
  const payment=await s.paymentIntents.retrieve(row.object_id);
  if(payment?.id!==row.object_id||payment?.object!=='payment_intent'||
    payment.status!=='succeeded'||payment.currency!=='usd'||
    payment.metadata?.rtc_run!==run.id||
    ref(payment.customer)!==customer.object_id||
    !valid(payment.amount)||payment.amount_received!==payment.amount)
    throw new TypeError('A completed run-owned USD card payment could not be verified');
  const chargeId=ref(payment.latest_charge);
  if(!checks.id.test(chargeId??''))throw new TypeError('No verified refundable Stripe charge');
  const charge=await s.charges.retrieve(chargeId);
  if(charge?.id!==chargeId||charge.object!=='charge'||charge.paid!==true||
    charge.refunded===true||charge.currency!=='usd'||
    charge.amount!==payment.amount||charge.amount_refunded!==0||
    ref(charge.customer)!==customer.object_id)
    throw new TypeError('TEST charge is not fully paid, unrefunded and customer-matched');
  return {...charge,customer:ref(charge.customer),
    metadata:{...charge.metadata,...payment.metadata},
    _amountCents:charge.amount,_runId:run.id,_step:a.paymentStep};
}
function verifiedRefund(before,after,id){
  return after?.object==='refund'&&after.id===id&&
    /^re_[A-Za-z0-9]{2,100}$/.test(id??'')&&
    ref(after.charge)===before.id&&
    after.currency==='usd'&&after.amount===before._amountCents&&
    after.metadata?.rtc_run===before._runId&&
    ['succeeded','pending','requires_action'].includes(after.status);
}
export function makeDevSeedRefundWrite(){
  let created=null,source=null;
  const op=defineWrite({
    name:'dev_seed_refund',
    read:async(a,ctx)=>{
      validateFields(a,fields,['runId','paymentStep']);
      if(ctx?.connection?.mode!=='test')
        throw new TypeError('Recorded developer refunds require TEST mode');
      return preflight(a,ctx);
    },
    summarize:b=>'TEST MODE. Refund in full the recorded synthetic card charge '+
      b.id+' for run '+b._runId+', step '+b._step+
      ', $'+(b._amountCents/100).toFixed(2)+' USD. '+
      'Independent owner approval for this exact charge and amount is mandatory; '+
      'above $500/account/Denver-day needs another separate override.',
    money:async(_a,_ctx,b)=>({
      amountCents:b._amountCents,currency:'usd',direction:'out',
      targetId:b.id,description:'Refund verified synthetic TEST store charge'
    }),
    apply:async(a,ctx,{before,idempotencyKey})=>{
      source=before;
      const s=await client(ctx);
      created=await s.refunds.create({charge:before.id,amount:before._amountCents,
        reason:'requested_by_customer',metadata:{rtc_run:a.runId}},
        {idempotencyKey});
      if(created?.object!=='refund'||!/^re_[A-Za-z0-9]{2,100}$/.test(created.id??''))
        throw new TypeError('Stripe refund creation not acknowledged for expected type');
    },
    readAfter:async(a,ctx)=>{
      if(!created?.id||!source)return null;
      const s=await client(ctx);
      const after=await s.refunds.retrieve(created.id);
      if(verifiedRefund(source,after,created.id)){
        const recorded=await ctx.db.recordDevRunRefund({
          account:ctx.connection.stripeAccount,id:a.runId,
          paymentStep:a.paymentStep,refundId:created.id});
        if(!recorded)throw new Error('Confirmed TEST refund could not be recorded in its run');
      }
      return after;
    },
    verify:(before,after)=>verifiedRefund(before,after,created?.id)
  });
  return {...op,handler:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Tracked developer refund requires TEST mode'):op.handler(a,ctx)};
}
export const tools=[(()=>{
  const op=makeDevSeedRefundWrite();
  return {...op.tool,area:'developer',profiles:writeProfiles,moneyOut:true,
    description:'Refund one tracked TEST store payment after independent owner approval.',
    inputSchema:{type:'object',properties:{...fields,
      dryRun:{type:'boolean'},confirm:{type:'boolean'},
      requestKey:{type:'string',minLength:1,maxLength:128}},
      required:['runId','paymentStep'],additionalProperties:false}};
})()];
export const handlers={
  dev_seed_refund:async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test')return gone('TEST mode required');
    const s=await client(ctx);
    return makeDevSeedRefundWrite().handler(a,{
      ...ctx,getCustomer:id=>s.customers.retrieve(id)});
  }
};
