// W-8: account/profile-scoped readiness across projects.
// LIVE stays completely unqueried and off until independently authorized.
import {allProfiles,reply,fail} from './billing-shared.js';
import {nativeRead,verifyContext,deadline,expired} from './workflow-read-common.js';
const app=/^[a-z][a-z0-9-]{2,63}$/;
const endpoint=/^we_[A-Za-z0-9]{2,100}$/;
const portal=/^bpc_[A-Za-z0-9_]{3,190}$/;
const config=/^pmc_[A-Za-z0-9]{2,100}$/;
const fields={
  apps:{type:'array',minItems:1,maxItems:6,uniqueItems:true,
    items:{type:'string',pattern:app.source}},
  webhookEndpoint:{type:'string',pattern:endpoint.source},
  portalConfiguration:{type:'string',pattern:portal.source},
  paymentMethodConfiguration:{type:'string',pattern:config.source}
};
export const tools=[{
  name:'workflow_go_live_checklist',area:'workflows',profiles:allProfiles,
  writes:false,annotations:{readOnlyHint:true},
  description:'Review selected TEST project readiness and explicitly unverified LIVE parity, without production writes.',
  inputSchema:{type:'object',properties:fields,additionalProperties:false}
}];
const classifications=new Set(['done','missing','not_readable','needs_you',
  'needs_decision','not_applicable']);
function validate(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!Object.hasOwn(fields,k))||
    a.apps!==undefined&&(!Array.isArray(a.apps)||a.apps.length<1||
      a.apps.length>6||new Set(a.apps).size!==a.apps.length||
      a.apps.some(x=>!app.test(x)))||
    a.webhookEndpoint!==undefined&&!endpoint.test(a.webhookEndpoint)||
    a.portalConfiguration!==undefined&&!portal.test(a.portalConfiguration)||
    a.paymentMethodConfiguration!==undefined&&
      !config.test(a.paymentMethodConfiguration))
    throw new TypeError('Select up to six bound TEST apps and optional exact settings IDs');
}
async function checklist(a,ctx){
  verifyContext(ctx);validate(a);
  if(!ctx.db?.listKnownAppsForAccount)
    throw new TypeError('Original durable TEST app binding unavailable');
  const list=await ctx.db.listKnownAppsForAccount(ctx.connection.stripeAccount);
  if(!Array.isArray(list)||list.length>100)
    throw new TypeError('Original bound project collection unavailable');
  if(a.apps&&a.apps.some(id=>!list.some(p=>p.id===id)))
    throw new TypeError('One selected project is not bound to this TEST account');
  const selected=(a.apps?list.filter(p=>a.apps.includes(p.id)):list);
  if(selected.length>6)throw new TypeError('Select up to six bound apps per readiness report');
  const end=deadline(),result=[],gaps=[];
  for(const project of selected){
    if(expired(end)){gaps.push({app:project.id,reason:'time_budget'});break;}
    if(project.status!=='active'||!project.profile||
      !project.profile.stripe_accounts?.includes(ctx.connection.stripeAccount))
      throw new TypeError('Inactive or unbound profile in verified account list');
    const owns=project.profile.owns_catalog;
    if(typeof owns!=='boolean'||!Array.isArray(project.profile.webhook_events))
      throw new TypeError('Bound application ownership policy incomplete');
    const options={app:project.id,
      ...(a.webhookEndpoint?{webhookEndpoint:a.webhookEndpoint}:{}),
      ...(a.portalConfiguration?{portalConfiguration:a.portalConfiguration}:{}),
      ...(a.paymentMethodConfiguration?{
        paymentMethodConfiguration:a.paymentMethodConfiguration}:{})};
    let test;
    try{test=await nativeRead('workflow_app_readiness',options,ctx);}
    catch{gaps.push({app:project.id,reason:'protected_test_read_unavailable'});continue;}
    if(test.app!==project.name||test.account!==ctx.connection.stripeAccount||
      test.mode!=='test'||!Array.isArray(test.rows)||
      test.rows.length!==21||new Set(test.rows.map(x=>x.id)).size!==21||
      test.rows.some(x=>!classifications.has(x.status))||
      test.liveProviderQueried!==false)
      throw new TypeError('Complete selected TEST readiness matrix unavailable');
    let live;
    // The existing P-3 live sentinel does not contact the provider:
    // no assumptions about production keys or authorizations leak in.
    try{live=await nativeRead('workflow_app_readiness',
      {...options,mode:'live'},ctx);}
    catch{gaps.push({app:project.id,reason:'live_sentinel_unavailable'});continue;}
    if(live.mode!=='live'||live.liveProviderQueried!==false||
      live.ready!==false||live.rows?.length!==21||
      live.rows.some(x=>x.status==='done'&&x.id!=='S21'))
      throw new TypeError('LIVE access boundary cannot be independently established');
    const rows=test.rows.map(x=>({
      id:x.id,status:x.status,
      ...(typeof x.note==='string'?{note:x.note.slice(0,180)}:{}),
      ...(typeof x.settingsUrl==='string'?{settingsUrl:x.settingsUrl}:{}),
      ...(typeof x.ownerAction==='string'?{ownerAction:x.ownerAction.slice(0,160)}:{})
    }));
    const needs=rows.filter(x=>!['done','not_applicable'].includes(x.status));
    result.push({app:project.id,name:project.name,
      source:'bound_profile',profileVersion:project.version,
      test:{ready:test.ready===true&&needs.length===0,
        checks:rows,counts:Object.fromEntries([...classifications]
          .map(s=>[s,rows.filter(x=>x.status===s).length])),
        needsOwnerAction:needs.map(x=>x.id)},
      live:{status:'not_verified',readPerformed:false,source:'protected_live_sentinel',
        needsSeparateOwnerApproval:true,parityVerified:false,
        note:'No LIVE key, webhook, payment-method or catalog state was queried.'},
      webhook:{requiredEventCount:project.profile.webhook_events.length,
        testEndpointSelection:a.webhookEndpoint??null,
        endpointAcceptance:'separate_exact_webhook_health_check'},
      catalog:{ownedByApp:owns,eligibleForFutureCopyPlan:!owns,
        copyExecuted:false,
        nextAction:owns?'Catalog is owned by this project; never copy or replace it':
          'Only after separate LIVE authorization may exact TEST catalog candidates be individually reviewed'},
      actions:needs.map(x=>({id:x.id,status:x.status,
        ownerAction:x.ownerAction??'Inspect original project readiness row'}))
    });
  }
  return {account:ctx.connection.stripeAccount,mode:'test',
    complete:gaps.length===0&&!expired(end),projects:result,
    projectCount:result.length,gaps,
    liveParity:'not_verified',liveProviderQueried:false,liveEnabled:false,
    autoCatalogCopy:false,anyLiveWrite:false,
    readyToGoLive:false,
    note:'TEST readiness does not certify LIVE parity or activate production. Independently verify each owner-controlled LIVE setting before any activation.'};
}
export const handlers={
  async workflow_go_live_checklist(a,ctx){
    try{return reply(await checklist(a,ctx));}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
