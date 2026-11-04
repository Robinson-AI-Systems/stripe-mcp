// P-4: one confirmed child mutation per durable step, never an untracked batch.
// An incomplete or uncertain child cannot be replayed automatically.
import {defineWrite} from './write.js';
import {client,allProfiles,fullProfiles,reply,fail} from './billing-shared.js';
import {readVerifiedTestAccount,readVerifiedLiveAccount} from '../stripe/test-account.js';
import {draftFromFindings,normalizedSetup,appNeeds} from '../projects/setup.js';

const bad=x=>{throw new TypeError(x);};
const bo={type:'boolean'},reqKey={type:'string',minLength:1,maxLength:128};
const fingerprint={type:'string',maxLength:64};
const schema=(p,r=[])=>({type:'object',properties:p,required:r,additionalProperties:false});
const acct=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);
const json=r=>{
  try{return JSON.parse(r?.content?.[0]?.text);}catch{return null;}
};
// Owner-obedience V2 family 13, provider-write half (ruling 4):
// the selected account is verified in the connection's own mode —
// the historical TEST proof in TEST, the independent LIVE account
// and balance proof in LIVE. Any other mode keeps the historical
// refusal text.
async function verified(ctx,{needsDb=false}={}){
  const mode=ctx?.connection?.mode;
  if(!['test','live'].includes(mode)||!acct(ctx?.connection?.stripeAccount))
    bad('Exact selected TEST account required');
  if(needsDb&&(!ctx.db||[
    'getProjectSetupRun','reserveProjectSetupStep','completeProjectSetupStep',
    'createProjectDraft','getKnownApp'].some(k=>typeof ctx.db[k]!=='function')))
    bad('Durable project setup state or draft registry unavailable');
  const sdk=await client(ctx);
  if(mode==='live')
    await readVerifiedLiveAccount(sdk,ctx.connection.stripeAccount);
  else await readVerifiedTestAccount(sdk,ctx.connection.stripeAccount);
  return sdk;
}
function safePortal(o,mode){
  if(o?.object!=='billing_portal.configuration'||o.livemode!==(mode==='live')||
    !/^bpc_[A-Za-z0-9_]{3,190}$/.test(o.id??'')||
    o.application||o.active!==true)return null;
  return o;
}
function desiredPortal(p){
  // Creating a configuration is a distinct privileged native write, not a
  // Billing Portal session. Never grant cancellation/plan switching by default.
  return {features:{
    payment_method_update:{enabled:p.allow_payment_method_update},
    invoice_history:{enabled:p.allow_invoice_history},
    subscription_cancel:{enabled:p.allow_cancel},
    subscription_update:{enabled:p.allow_plan_switch}
  }};
}
function portalWrite(){
  let id=null;
  return defineWrite({
    name:'project_portal_create',
    read:async(a,ctx)=>{
      if(!a||typeof a!=='object'||Array.isArray(a)||
        Object.keys(a).some(x=>![
          'portalRules','dryRun','confirm','requestKey','previewFingerprint'].includes(x))||
        !a.portalRules||typeof a.requestKey!=='string'||!a.requestKey||
        a.requestKey.length>128)bad('Explicit portal policy and stable key required');
      const rules=a.portalRules,names=['allow_cancel','allow_plan_switch',
        'allow_payment_method_update','allow_invoice_history'];
      if(Object.keys(rules).length!==4||
        Object.keys(rules).some(x=>!names.includes(x))||
        names.some(x=>typeof rules[x]!=='boolean'))
        bad('Complete four-choice Portal policy required');
      await verified(ctx);
      return {id:ctx.connection.stripeAccount,metadata:{}};
    },
    summarize:(b,_a,ctx)=>ctx?.connection?.mode==='live'?
      'LIVE '+b.id+
      ': create one independent native Billing Portal configuration with explicit four-choice policy.'+
      ' Guarded confirmation, stable request key and provider readback; the configuration is created'+
      ' on the LIVE account, where real customers can use it; no app profile is bound to the account'+
      ' and no app policy is activated.':
      'TEST '+b.id+
      ': create one independent native Billing Portal configuration with explicit four-choice policy.'+
      ' Guarded confirmation, stable request key and provider readback; no LIVE or app policy activation.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await verified(ctx);
      const created=await s.billingPortal.configurations.create(
        desiredPortal(a.portalRules),{idempotencyKey});
      if(!safePortal(created,ctx.connection.mode))bad('Unsafe Portal creation response');
      id=created.id;
    },
    readAfter:async(_a,ctx)=>{
      if(!id)return null;
      const s=await verified(ctx);
      return s.billingPortal.configurations.retrieve(id);
    },
    verify:(_before,after,a,ctx)=>{
      const p=safePortal(after,ctx?.connection?.mode);
      if(!p||p.id!==id)return false;
      const expected=desiredPortal(a.portalRules).features;
      return Object.keys(expected).every(k=>
        p.features?.[k]?.enabled===expected[k].enabled);
    },
    resultId:(_before,after)=>after?.id
  });
}
const portalTool=portalWrite().tool;
async function wrappedChild(name,args,ctx){
  // Call the same guarded native tool surface used by direct MCP. Never
  // dispatch unguarded SDK mutations from this workflow.
  const {registry}=await import('./index.js');
  const tool=registry.tools.find(x=>x.name===name);
  if(!tool?.writes||!tool.profiles?.includes('full')||
    ctx.connection.profile!=='full')bad('No permitted guarded child: '+name);
  const response=await registry.handlers[name](args,ctx),value=json(response);
  if(response?.isError||value?.done!==true||value.confirmed!==true)
    bad('Nested '+name+' did not confirm its readback; reconcile original run before retry');
  return value;
}
function receiptId(out,kind){
  const value=kind==='webhook'?out.endpointId:out.resourceId;
  const prefix=kind==='product'?'prod':kind==='price'?'price':
    kind==='webhook'?'we':kind==='portal'?'bpc':null;
  if(prefix&&!new RegExp('^'+prefix+'_[A-Za-z0-9_]{2,190}$').test(value??''))
    bad('Native child did not return a verified '+kind+' resource ID');
  return value??null;
}
function summarizePlan(plan,run){
  const steps=plan.steps.map(name=>({name,
    state:run?.steps?.[name]?.state??'not_started',
    resourceId:run?.steps?.[name]?.resourceId??null,
    ...(run?.steps?.[name]?.manualRequired?{manualRequired:true}:{})}));
  const next=steps.find(x=>x.state!=='done')?.name??null;
  return {project:plan.profile.id,status:next?'in_progress':'draft_created',
    nextStep:next,steps,needsReview:plan.needsReview,
    profileStatus:'draft',accountBound:false,liveEnabled:false};
}
function setupWrite(){
  let plan=null,step=null,child=null;
  const op=defineWrite({
    name:'workflow_project_setup',
    read:async(a,ctx)=>{
      if(!a||typeof a!=='object'||Array.isArray(a)||
        Object.keys(a).some(x=>!['project','requestKey','dryRun','confirm','previewFingerprint'].includes(x))||
        typeof a.requestKey!=='string'||a.requestKey.length<1||
        a.requestKey.length>100)bad('Exact project and stable requestKey required');
      plan=normalizedSetup(a.project);
      await verified(ctx,{needsDb:true});
      const account=ctx.connection.stripeAccount;
      const existing=await ctx.db.getKnownApp(plan.profile.id);
      if(existing?.status==='active'||existing?.status==='disabled')
        bad('Existing activated or disabled application cannot be replaced by project setup');
      const run=await ctx.db.getProjectSetupRun({account,id:plan.profile.id});
      if(existing?.status==='draft'&&!run)
        bad('Existing unrelated draft must be reconciled before starting provider setup');
      if(run&&run.digest!==plan.digest)bad('Project requirements changed; reconcile original setup run');
      step=summarizePlan(plan,run).nextStep;
      if(!step)bad('This project setup is already complete; inspect its draft instead');
      if(run?.steps?.[step]?.state==='pending')
        bad('Previous setup step outcome uncertain; reconcile before a retry');
      if(step==='price'&&!run?.steps?.product?.resourceId)
        bad('Independent product readback missing; price cannot be created');
      return {id:account,metadata:{},step};
    },
    summarize:(_before,_a,ctx)=>{
      const live=ctx?.connection?.mode==='live';
      return (live?'LIVE':'TEST')+' project '+plan.profile.id+': confirm ONLY '+step+
        ' of '+plan.steps.join(' → ')+'. Other steps need separate confirmation.'+
        ' Pending provider outcomes cannot be automatically replayed; draft never activates ownership.'+
        (live?' Provider objects for this step are created or verified on the LIVE account;'+
          ' the setup records a draft profile only — it does not bind the profile to the account'+
          ' and does not enable scoped ownership.':'');
    },
    apply:async(a,ctx)=>{
      const account=ctx.connection.stripeAccount,id=plan.profile.id,digest=plan.digest;
      const reserve=await ctx.db.reserveProjectSetupStep({account,id,digest,step});
      if(!reserve.newlyReserved)bad('Setup step is already reserved/done; refresh exact run');
      const p=plan.project,key=a.requestKey+'-'+step;
      let outcome=null,resultId=null,manual=false;
      if(step==='webhook'){
        outcome=await wrappedChild('webhook_create',{
          url:p.webhookUrl,events:p.webhookEvents,
          description:'Project '+id+' '+(ctx.connection.mode==='live'?'LIVE':'TEST')+' webhook',requestKey:key,confirm:true},ctx);
        resultId=receiptId(outcome,'webhook');
      }else if(step==='portal'){
        const name=p.portalConfiguration?'portal_update_configuration':
          'project_portal_create';
        outcome=await wrappedChild(name,p.portalConfiguration?{
          configId:p.portalConfiguration,
          paymentMethodUpdate:p.portalRules.allow_payment_method_update,
          invoiceHistory:p.portalRules.allow_invoice_history,
          subscriptionCancel:p.portalRules.allow_cancel,
          subscriptionUpdate:p.portalRules.allow_plan_switch,
          requestKey:key,confirm:true
        }:{portalRules:p.portalRules,requestKey:key,confirm:true},ctx);
        resultId=p.portalConfiguration??receiptId(outcome,'portal');
      }else if(step==='methods'){
        if(!p.paymentMethodConfiguration){
          // No account-global configuration is invented or changed without an
          // exact owner-selected identifier; carry owner action into the draft.
          manual=true;
        }else{
          outcome=await wrappedChild('account_update_payment_method_settings',{
            configuration:p.paymentMethodConfiguration,method:'us_bank_account',
            preference:'on',requestKey:key,confirm:true},ctx);
          resultId=p.paymentMethodConfiguration;
        }
      }else if(step==='brand'){
        const existing=await ctx.db.getBrandKit({account,mode:ctx.connection.mode});
        outcome=await wrappedChild('brand_save_kit',{
          kit:p.brandKit,expectedVersion:existing?.version??0,
          requestKey:key,confirm:true},ctx);
      }else if(step==='product'){
        outcome=await wrappedChild('product_create',{
          name:p.billing.productName,requestKey:key,confirm:true},ctx);
        resultId=receiptId(outcome,'product');
      }else if(step==='price'){
        const run=await ctx.db.getProjectSetupRun({account,id});
        outcome=await wrappedChild('price_create',{
          productId:run.steps.product.resourceId,lookupKey:p.billing.lookupKey,
          unitAmountCents:p.billing.amountCents,currency:'usd',
          ...(p.billing.kind==='monthly'?{interval:'month'}:{}),
          requestKey:key,confirm:true},ctx);
        resultId=receiptId(outcome,'price');
      }else if(step==='draft'){
        const draft=await ctx.db.createProjectDraft(plan.profile);
        if(draft.status!=='draft'||draft.id!==id)bad('Profile draft readback failed');
      }
      await ctx.db.completeProjectSetupStep({account,id,digest,step,
        resourceId:resultId,details:{kind:step,
          ...(manual?{manualRequired:true}:{})}});
      child=outcome?.setupPath?{
        ownerSetupPath:outcome.setupPath,
        note:'Open only in independently authenticated owner browser; not a public signing secret'
      }:null;
    },
    readAfter:async(_a,ctx)=>{
      const run=await ctx.db.getProjectSetupRun({
        account:ctx.connection.stripeAccount,id:plan.profile.id});
      return run?.steps?.[step]??null;
    },
    verify:(_b,observed)=>observed?.state==='done'&&
      observed.kind===step,
    resultId:null
  });
  return {tool:op.tool,handler:async(a,ctx)=>{
    plan=null;step=null;child=null;
    // A completed setup is an idempotent read, not another provider mutation.
    let checked,run;
    try{
      checked=normalizedSetup(a?.project);
      await verified(ctx,{needsDb:true});
      run=await ctx.db.getProjectSetupRun({
        account:ctx.connection.stripeAccount,id:checked.profile.id});
      if(run&&run.digest!==checked.digest)
        bad('Project requirements changed; original setup run must be reconciled');
      if(run&&summarizePlan(checked,run).nextStep===null){
        const draft=await ctx.db.getKnownApp(checked.profile.id);
        if(draft?.status!=='draft')bad('Recorded setup finished but draft is unavailable');
        return reply({...summarizePlan(checked,run),done:true,confirmed:true,
          profile:checked.profile,appNeeds:checked.appNeeds});
      }
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
    const result=await op.handler(a,ctx);
    if(result.isError)return result;
    const value=json(result);
    if(value?.done!==true)return result;
    const current=await ctx.db.getProjectSetupRun({
      account:ctx.connection.stripeAccount,id:checked.profile.id});
    return reply({...value,...summarizePlan(checked,current),
      ...(child??{}),
      ...(summarizePlan(checked,current).nextStep===null?{
        profile:checked.profile,appNeeds:checked.appNeeds}:{}),
      nextAction:summarizePlan(checked,current).nextStep?
        'Review then individually confirm next setup step':
        'Owner reviews draft APP-NEEDS text; account/app ownership stays inactive'});
  }};
}
const setup=setupWrite();
export const tools=[
  {name:'project_draft_profile',area:'projects',writes:false,
    profiles:allProfiles,annotations:{readOnlyHint:true},
    description:'Transform explicitly supplied code findings into review-only project profile and APP-NEEDS text.',
    inputSchema:schema({findings:{type:'object'}},['findings'])},
  {...portalTool,area:'projects',profiles:fullProfiles,safety:'C',
    description:'Create one confirmed native Billing Portal configuration from exact owner policy in the connection mode.',
    inputSchema:schema({portalRules:{type:'object'},
      requestKey:reqKey,dryRun:bo,confirm:bo,previewFingerprint:fingerprint},
      ['portalRules','requestKey'])},
  {...setup.tool,area:'projects',profiles:fullProfiles,safety:'C',
    description:'Advance one durable, separately confirmed native project setup step in the connection mode; never activate a draft.',
    inputSchema:schema({project:{type:'object'},requestKey:reqKey,
      dryRun:bo,confirm:bo,previewFingerprint:fingerprint},
      ['project','requestKey'])}
];
export const handlers={
  project_draft_profile(a){
    try{
      if(!a||typeof a!=='object'||Array.isArray(a)||
        Object.keys(a).some(k=>k!=='findings'))
        bad('Only explicit code findings are accepted');
      const draft=draftFromFindings(a.findings);
      return reply({...draft,appNeeds:appNeeds(draft),
        note:'Review and commit text manually in the project repository; no code fetched'});
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  project_portal_create:(a,ctx)=>portalWrite().handler(a,ctx),
  workflow_project_setup:(a,ctx)=>setupWrite().handler(a,ctx)
};
