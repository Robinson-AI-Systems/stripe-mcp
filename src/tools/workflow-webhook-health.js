// W-7: exact TEST webhook event coverage and safe global undelivered diagnostics.
// Native provider webhook_get compares complete subscription lists, not truncated samples.
import {createHash} from 'node:crypto';
import {allProfiles,reply,fail} from './billing-shared.js';
import {verifyContext,nativeRead,collect,deadline,expired} from './workflow-read-common.js';
import {writable,nativeWrite,readyStep} from './workflow-customer-actions.js';
const endpoint=/^we_[A-Za-z0-9]{2,100}$/;
const app=/^[a-z][a-z0-9-]{2,63}$/;
const props={
  endpointId:{type:'string',pattern:endpoint.source},
  apps:{type:'array',minItems:1,maxItems:6,uniqueItems:true,
    items:{type:'string',pattern:app.source}},
  includeUndelivered:{type:'boolean'},
  previewToken:{type:'string',pattern:'^[a-f0-9]{64}$'},
  confirm:{type:'boolean'},dryRun:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:100}
};
export const tools=[
  {name:'workflow_webhook_health',area:'workflows',profiles:allProfiles,
    writes:false,annotations:{readOnlyHint:true},
    description:'Read complete TEST webhook coverage for bound projects and honest global three-day delivery gaps.',
    inputSchema:{type:'object',properties:{endpointId:props.endpointId,
      apps:props.apps,includeUndelivered:props.includeUndelivered},
      required:['endpointId','apps'],additionalProperties:false}},
  {name:'workflow_webhook_health_fix',area:'workflows',profiles:['everyday','full'],
    writes:true,writeContract:'defineWrite-v1',safety:'P',moneySpec:null,
    description:'Preview then add only exact missing TEST events via original guarded webhook_add_events.',
    inputSchema:{type:'object',properties:props,
      required:['endpointId','apps'],additionalProperties:false}}
];
function validate(a,write=false){
  if(!a||typeof a!=='object'||Array.isArray(a)||!endpoint.test(a.endpointId??'')||
    !Array.isArray(a.apps)||a.apps.length<1||a.apps.length>6||
    new Set(a.apps).size!==a.apps.length||a.apps.some(x=>!app.test(x))||
    Object.keys(a).some(k=>!Object.hasOwn(props,k)||
      !write&&['confirm','dryRun','requestKey','previewToken'].includes(k))||
    a.includeUndelivered!==undefined&&typeof a.includeUndelivered!=='boolean')
    throw new TypeError('Exact TEST webhook endpoint and 1–6 distinct bound apps required');
  if(write&&a.confirm===true&&(!a.previewToken||!a.requestKey||a.dryRun===true))
    throw new TypeError('Exact fresh previewToken and requestKey required');
}
const hash=(account,details,missing,preview)=>createHash('sha256')
  .update(JSON.stringify({account,kind:'webhook-health-fix',details,missing,preview}))
  .digest('hex');
async function source(a,ctx,{scan=true}={}){
  verifyContext(ctx);validate(a,!!('confirm'in a||'previewToken'in a||'requestKey'in a));
  if(typeof ctx.db?.getKnownApp!=='function')
    throw new TypeError('Durable bound app profile registry unavailable');
  const profiles=[];
  for(const name of a.apps){
    const p=await ctx.db.getKnownApp(name);
    if(p?.status!=='active'||!p.profile?.stripe_accounts?.includes(ctx.connection.stripeAccount)||
      !Array.isArray(p.profile.webhook_events)||p.profile.webhook_events.length>100||
      typeof p.profile.webhook_url!=='string')
      throw new TypeError('An active app is not bound to the selected TEST account');
    profiles.push({id:p.id,version:p.version,url:p.profile.webhook_url,
      events:[...p.profile.webhook_events].sort()});
  }
  const events=[...new Set(profiles.flatMap(p=>p.events))].sort();
  if(events.length>100)throw new TypeError('Too many required webhook event types');
  const endpointData=await nativeRead('webhook_get',{
    endpointId:a.endpointId,detail:'summary',
    requiredEvents:events,expectedDestinations:profiles.map(x=>x.url)
  },ctx);
  if(endpointData.id!==a.endpointId||endpointData.eventCoverage?.complete!==true||
    !Array.isArray(endpointData.eventCoverage.requirements)||
    endpointData.eventCoverage.requirements.length!==events.length||
    !Array.isArray(endpointData.destinationComparisons)||
    endpointData.destinationComparisons.length!==profiles.length)
    throw new TypeError('Complete exact provider webhook coverage not available');
  const coverage=new Map();
  for(const item of endpointData.eventCoverage.requirements){
    if(!events.includes(item.event)||typeof item.covered!=='boolean'||coverage.has(item.event))
      throw new TypeError('Invalid exact provider event coverage');
    coverage.set(item.event,item.covered);
  }
  const projects=profiles.map((p,i)=>{
    const match=endpointData.destinationComparisons[i];
    if(match.index!==i||typeof match.matches!=='boolean')
      throw new TypeError('Webhook endpoint route comparison is unavailable');
    const missing=p.events.filter(e=>!coverage.get(e));
    return {id:p.id,profileVersion:p.version,
      expectedEventCount:p.events.length,missingEvents:missing,
      destinationMatches:match.matches,
      status:endpointData.status!=='enabled'?'disabled':
        !match.matches?'wrong_destination':missing.length?'missing_events':'covered',
      note:'Event subscription coverage is not proof of delivery or app processing'};
  });
  const missing=[...new Set(projects.filter(p=>p.destinationMatches)
    .flatMap(p=>p.missingEvents))].sort();
  const end=deadline(),gaps=[],unDelivered=[];
  if(scan&&a.includeUndelivered!==false){
    const since=Math.floor(Date.now()/1000)-3*86400;
    const found=await collect('event_list_undelivered',{
      limit:25,detail:'full',createdGte:since
    },ctx,{end});
    if(!found.complete)gaps.push({section:'global_undelivered_events',
      reason:found.reason,inspected:found.data.length});
    for(const e of found.data.slice(0,25)){
      if(typeof e.id==='string'&&typeof e.type==='string')
        unDelivered.push({id:e.id,type:e.type,pendingWebhooks:e.pendingWebhooks??null});
    }
  }
  const complete=gaps.length===0&&!expired(end);
  return {account:ctx.connection.stripeAccount,mode:'test',
    endpoint:{id:a.endpointId,status:endpointData.status,
      destinationOrigin:endpointData.destinationOrigin,
      enabledEventCount:endpointData.enabledEventCount,
      subscriptionRevision:endpointData.subscriptionRevision,
      wildcard:endpointData.eventCoverage.wildcard===true},
    projects,missingEvents:missing,repairable:complete&&missing.length>0&&
      missing.length<=8&&endpointData.status==='enabled'&&
      projects.every(p=>p.destinationMatches),
    complete,gaps,undelivered:{lookbackDays:3,scope:'ALL_ACCOUNT_WEBHOOK_DESTINATIONS',
      endpointSpecific:false,deliverySuccessFilter:false,
      verifiedGlobalScan:scan&&a.includeUndelivered!==false&&gaps.length===0,
      observedCount:unDelivered.length,displayTruncated:unDelivered.length>=25,
      examples:unDelivered,
      note:'Stripe global delivery_success=false does not identify this endpoint or prove downstream processing'},
    note:'No LIVE endpoint was queried or altered; endpoint destination paths and signing secrets are redacted.'};
}
async function fix(a,ctx){
  writable(ctx);validate(a,true);
  const current=await source(a,ctx,{scan:false});
  if(!current.repairable)
    throw new TypeError('No exact safe single-step webhook repair; fix destination or split after owner review');
  const params={endpointId:a.endpointId,events:current.missingEvents};
  const preview=await readyStep('webhook_add_events',params,ctx);
  const token=hash(ctx.connection.stripeAccount,{
    endpoint:current.endpoint,projects:current.projects},current.missingEvents,
    preview.preview);
  const result={account:current.account,mode:'test',endpoint:current.endpoint,
    projects:current.projects,missingEvents:current.missingEvents,
    previewToken:token,nativePreview:preview.preview,done:false,
    needsConfirmation:true,unrelatedEventsPreserved:true};
  if(a.confirm!==true)return result;
  if(a.previewToken!==token)
    throw new TypeError('Webhook source or profile policy changed; preview again');
  try{
    const call=await nativeWrite('webhook_add_events',
      {...params,confirm:true,requestKey:a.requestKey+':events'},ctx);
    if(call.isError||call.value.done!==true||call.value.confirmed!==true)
      return {...result,done:false,confirmed:false,needsConfirmation:false,
        warning:'Native guarded webhook addition denied or uncertain; do not retry automatically'};
    const refreshed=await source(a,ctx,{scan:false});
    const done=refreshed.projects.every(p=>p.status==='covered');
    return {...result,done,confirmed:done,needsConfirmation:false,
      after:refreshed.projects,warning:done?null:
        'Original TEST provider readback is incomplete; inspect audit and endpoint'};
  }catch{return {...result,done:false,confirmed:false,needsConfirmation:false,
    warning:'Native TEST webhook update outcome uncertain; reconcile audit before retry'};}
}
export const handlers={
  async workflow_webhook_health(a,ctx){
    try{return reply(await source(a,ctx));}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  },
  async workflow_webhook_health_fix(a,ctx){
    try{return reply(await fix(a,ctx));}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
