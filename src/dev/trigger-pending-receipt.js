// V-3: actionable, account-scoped receipts for genuinely incomplete native
// TEST trigger writes. No provider reads/writes and never a success receipt.
import {planTrigger} from './triggers.js';
const RUN=/^run_[a-f0-9]{24}$/;
const ACCOUNT=/^acct_[A-Za-z0-9]{2,100}$/;
const SOURCE_ID={
  customer:'cus',product:'prod',price:'price',subscription:'sub',
  invoice:'in',payment_intent:'pi',invoice_item:'ii',
  charge:'ch',dispute:'du',checkout_session:'cs_test',event:'evt'
};
export async function pendingTriggerReceipt(a,ctx,response){
  // Do not turn a refused/unauthorized/preview invocation into a run
  // existence oracle; only a fully audited attempted confirmed write qualifies.
  if(ctx?.connection?.mode!=='test'||!ACCOUNT.test(
    ctx.connection.stripeAccount??'')||response?.isError===true||
    a?.confirm!==true||a?.dryRun===true||
    typeof response?.content?.[0]?.text!=='string')
    return response;
  let original;
  try{original=JSON.parse(response.content[0].text);}
  catch{return response;}
  if(original?.done!==false||original?.confirmed!==false||
    typeof original.idempotencyKey!=='string'||
    !/^rmcp_[a-zA-Z0-9_]+$/.test(original.idempotencyKey))
    return response;
  if(typeof ctx.db?.getDevRun!=='function'||
    typeof ctx.db?.getDevRunObjects!=='function')return response;
  let plan,run,rows;
  const account=ctx.connection.stripeAccount;
  try{
    plan=planTrigger(a,account);
    run=await ctx.db.getDevRun({account,requestKey:a.requestKey});
    if(!run||!RUN.test(run.id)||run.id!==plan.runId||
      run.stripe_account!==account||run.request_key!==a.requestKey||
      run.plan_digest!==plan.planDigest||run.scenario!==plan.scenario||
      run.size!==1||!['running','uncertain'].includes(run.status))
      return response;
    rows=await ctx.db.getDevRunObjects({account,id:run.id});
  }catch{return response;}
  if(!Array.isArray(rows)||rows.length<1||
    rows.length>plan.expectedSteps||rows.length>12)return response;
  const expected=new Map(plan.steps.map(s=>[s.name,s.type]));
  const seen=new Set();
  for(const row of rows){
    const type=expected.get(row?.step_name),prefix=SOURCE_ID[type];
    if(!type||type!==row.object_type||!prefix||seen.has(row.step_name)||
      typeof row.cleaned!=='boolean'||
      typeof row.object_id!=='string'||
      !new RegExp('^'+prefix+'_[A-Za-z0-9]{2,100}$').test(row.object_id))
      return response;
    seen.add(row.step_name);
  }
  // This run is not completed or accepted. The IDs below are from durable
  // exact-tenant audit, not inferred from an SDK response or object search.
  const enriched={...original,pendingRunId:run.id,pendingRunStatus:run.status,
    recordedSteps:rows.length,
    recoveryTool:'dev_inspect_incomplete_run',
    recoveryNote:'Pending selected-account TEST run, not a verified Stripe Event or successful write. Inspect run-owned source states without mutation; any retry must use the original guarded requestKey and pass current checks, or preview exact-run cleanup. No LIVE, refund or automatic retry.'};
  return {...response,content:[{type:'text',text:JSON.stringify(enriched)}]};
}
