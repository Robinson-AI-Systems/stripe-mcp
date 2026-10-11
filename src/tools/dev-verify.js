// V-1b4a: TEST-only provider observations, never inferred async success.
import {guarded,ref,allProfiles} from './billing-shared.js';
import {gone} from './write.js';
const id=(v,p)=>typeof v==='string'&&new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(v);
const fail=x=>{throw new TypeError(x);};
const exact=(rows,step,type,prefix)=>{
  const r=rows.find(x=>x.step_name===step);
  if(!r||r.cleaned!==false||r.object_type!==type||!id(r.object_id,prefix))
    fail('Recorded TEST '+step+' has no intact provider identity');
  return r.object_id;
};
const verifyPayment=(p,run,customer,pi,amount,ach)=>{
  if(p?.object!=='payment_intent'||p.id!==pi||p.livemode===true||
    p.metadata?.rtc_run!==run||p.currency!=='usd'||p.amount!==amount||
    ref(p.customer)!==customer||!Number.isSafeInteger(p.amount_received)||
    p.amount_received<0||p.amount_received>amount)
    fail('Provider payment ownership, provenance or amount differs');
  if(ach&&!p.payment_method_types?.includes('us_bank_account'))
    fail('This recorded TEST payment is not ACH');
  if(!ach&&(p.status!=='succeeded'||p.amount_received!==amount))
    fail('Dispute test-card payment is not fully paid');
};
const verifyCharge=(c,idValue,pi,customer,amount)=>{
  if(c?.id!==idValue||c.object!=='charge'||c.livemode===true||
    ref(c.payment_intent)!==pi||ref(c.customer)!==customer||
    c.currency!=='usd'||c.amount!==amount||
    c.paid!==true||c.status!=='succeeded')
    fail('The charge is not an independently verified TEST payment');
};
async function findDisputeCreatedEvent(s,account,charge,pi,amount){
  // Stripe can expire events; absence in this bounded window means unknown.
  let cursor,scanned=0,found=null;
  for(let page=0;page<3&&!found;page++){
    const res=await s.events.list({type:'charge.dispute.created',limit:100,
      ...(cursor?{starting_after:cursor}:{})});
    if(!Array.isArray(res?.data)||typeof res.has_more!=='boolean')
      fail('Provider event listing could not be validated');
    for(const e of res.data){
      const d=e?.data?.object;
      if(e.type==='charge.dispute.created'&&e.livemode===false&&
        (!e.account||e.account===account)&&d?.object==='dispute'&&
        ref(d.charge)===charge&&(!d.payment_intent||ref(d.payment_intent)===pi)&&
        d.amount===amount&&d.currency==='usd'&&id(e.id,'evt')){
        found=e.id;break;
      }
    }
    scanned+=res.data.length;
    if(!res.has_more||res.data.length===0)break;
    cursor=res.data.at(-1).id;
    if(!id(cursor,'evt'))fail('Provider event cursor is invalid');
  }
  return {found,scanned};
}
export async function observeSeedOutcomes(a,ctx,s){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>k!=='runId')||!/^run_[a-f0-9]{24}$/.test(a.runId??''))
    fail('Exact recorded TEST runId required');
  const account=ctx?.connection?.stripeAccount;
  if(ctx?.connection?.mode!=='test'||!id(account,'acct'))
    fail('Selected TEST account required');
  if(typeof ctx.db?.getDevRunById!=='function'||
    typeof ctx.db?.getDevRunObjects!=='function')
    fail('Durable TEST seed run store unavailable');
  const run=await ctx.db.getDevRunById({account,id:a.runId});
  if(!run||run.id!==a.runId||run.stripe_account!==account||
    run.status!=='completed'||!Number.isInteger(run.size)||
    run.size<1||run.size>5||
    !['dispute-trigger','ach-awaiting-confirmation'].includes(run.scenario))
    fail('Completed run-owned TEST dispute or ACH scenario required');
  const rows=await ctx.db.getDevRunObjects({account,id:run.id});
  const results=[];
  for(let i=1;i<=run.size;i++){
    const customer=exact(rows,'customer_'+i,'customer','cus');
    const pi=exact(rows,'payment_'+i,'payment_intent','pi');
    const amount=3500+100*i;
    const p=await s.paymentIntents.retrieve(pi);
    const ach=run.scenario==='ach-awaiting-confirmation';
    verifyPayment(p,run.id,customer,pi,amount,ach);
    if(ach){
      if(p.status==='succeeded'){
        if(p.amount_received!==amount)fail('ACH succeeded without full verified payment');
        const chargeId=ref(p.latest_charge);
        if(!id(chargeId,'ch'))fail('Succeeded ACH has no charge');
        verifyCharge(await s.charges.retrieve(chargeId),chargeId,pi,customer,amount);
      }else if(p.amount_received!==0||![
        'requires_confirmation','requires_payment_method','requires_action',
        'processing','canceled'
      ].includes(p.status))fail('Unsupported/partially received ACH status');
      results.push({paymentStep:'payment_'+i,paymentIntent:pi,
        providerStatus:p.status,verifiedPaymentSucceeded:p.status==='succeeded',
        bankSettlementVerified:false});
    }else{
      const chargeId=ref(p.latest_charge);
      if(!id(chargeId,'ch'))fail('Dispute test payment lacks verified charge');
      const c=await s.charges.retrieve(chargeId);
      verifyCharge(c,chargeId,pi,customer,amount);
      const found=c.disputed===true?
        (await findDisputeCreatedEvent(s,account,chargeId,pi,amount)).found:null;
      results.push({paymentStep:'payment_'+i,paymentIntent:pi,charge:chargeId,
        providerDisputed:c.disputed===true,disputeCreatedEventObserved:found!==null,
        disputeEventId:found,webhookDeliveredVerified:false});
    }
  }
  return {runId:run.id,scenario:run.scenario,mode:'test',outcomes:results,
    note:'Positive observations only. Missing Stripe events can be outside the bounded retained listing. Neither webhook delivery nor bank settlement is inferred.'};
}
export const tools=[{
  name:'dev_verify_outcomes',area:'developer',writes:false,profiles:allProfiles,
  description:'Verify actual TEST dispute-created events and ACH payment status for a tracked seed run; never infer bank settlement or webhook delivery.',
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties:{
    runId:{type:'string',pattern:'^run_[a-f0-9]{24}$'}
  },required:['runId'],additionalProperties:false}
}];
export const handlers={
  dev_verify_outcomes:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Developer outcome verification requires TEST mode'):
    guarded(ctx,async s=>observeSeedOutcomes(a,ctx,s))
};
