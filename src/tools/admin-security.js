// G-6c: TEST-only security posture readbacks; Dashboard login security is never inferred.
import {reply,fail,allProfiles} from './billing-shared.js';
import {handlers as owner} from './server.js';
import {handlers as webhooks} from './webhooks-read.js';
import {handlers as accountHandlers} from './account-profile.js';
import {whereIsSetting} from '../data/dashboard-map.js';
import {requireAdminTestAccount,readAdminTool,verifiedAdminIdentity} from './admin-read-safety.js';
const bad=m=>{throw new TypeError(m);};
const guide=setting=>({
  status:'not_readable',observed:false,
  dashboardUrl:whereIsSetting(setting).url,
  steps:whereIsSetting(setting).steps
});
function safeKey(v,id){
  if(v?.account!==id)return null;
  const keyType=['restricted','standard','unknown'].includes(v.keyType)?
    v.keyType:'not_readable';
  const keyLast4=typeof v.keyLast4==='string'&&/^[a-zA-Z0-9]{4}$/.test(v.keyLast4)?
    v.keyLast4:null;
  return {status:'stored_metadata',observed:true,
    keyType,keyLast4:keyLast4?'••••'+keyLast4:null,
    keyAge:'not_readable',activeAtStripe:'not_readable',
    note:'Stored key metadata alone does not prove key validity or freshness.'};
}
function safeProbe(v,id){
  if(v?.account!==id||v.mode!=='test'||!v.permissions||
    typeof v.permissions!=='object'||Array.isArray(v.permissions))
    return null;
  const entries=Object.entries(v.permissions);
  if(entries.length>100||entries.some(([k,x])=>k.length>80||
    !/^[a-zA-Z0-9_.-]+$/.test(k)||
    !['boolean','string','number','object'].includes(typeof x)))
    return null;
  // Provider permission details may contain unrecognized contents. Export no values or names.
  return {status:'observed',observed:true,checked:true,
    permissionEntriesInspected:entries.length,
    note:'Fresh TEST permission probe ran. Scope details remain in the secure owner setup.'};
}
export const tools=[{
  name:'admin_review_security',area:'admin',writes:false,profiles:allProfiles,
  annotations:{readOnlyHint:true},
  description:'Review masked TEST key metadata, scoped connections and webhook safety with honest Dashboard-only security gaps.',
  inputSchema:{type:'object',properties:{},additionalProperties:false}
}];
export const handlers={
  async admin_review_security(a,ctx){
    try{
      if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).length)
        bad('Security review takes no parameters');
      const id=requireAdminTestAccount(ctx);
      const result={account:id,mode:'test',readOnly:true,sections:{}};
      const info=await readAdminTool(owner.stripe_whoami,{},ctx);
      result.sections.key=safeKey(info,id)??guide('api_keys');
      const probe=await readAdminTool(owner.stripe_check_key_permissions,{},ctx);
      result.sections.keyPermissions=safeProbe(probe,id)??guide('restricted_key_creation');
      const connections=await readAdminTool(owner.stripe_list_connections,{limit:20},ctx);
      if(connections?.account===id&&Array.isArray(connections.connections)&&
        typeof connections.hasMore==='boolean'&&connections.connections.length<=20){
        result.sections.connections={status:'observed',observed:true,
          countOnPage:connections.connections.length,
          complete:!connections.hasMore,hasMore:connections.hasMore,
          note:'Selected account connections only; no bearer tokens, refresh hashes or client identifiers.'};
      }else{
        result.sections.connections={status:'not_readable',observed:false,
          note:'Connected pass/agent inventory was not accessible to this session.'};
      }
      const identity=await readAdminTool(accountHandlers.account_get,{},ctx);
      const hook=verifiedAdminIdentity(identity,id)?
        await readAdminTool(webhooks.webhook_list,{limit:5},ctx):null;
      if(hook&&Array.isArray(hook.data)&&hook.data.length<=5&&
        typeof hook.has_more==='boolean'&&hook.data.every(v=>
          typeof v.id==='string'&&['enabled','disabled'].includes(v.status))){
        result.sections.webhooks={status:'observed',observed:true,
          endpoints:hook.data.map(v=>({id:v.id,status:v.status,
            enabledEventCount:v.enabledEventCount??null})),
          complete:!hook.has_more,hasMore:hook.has_more,
          note:'Only TEST endpoint metadata; destinations and signing secrets are not disclosed.'};
      }else result.sections.webhooks=guide('webhook_events');
      result.sections.twoStepLogin=guide('two_step_login');
      result.sections.teamRoles=guide('team_members');
      result.sections.pendingInvitations=guide('team_invitations');
      result.sections.connectedApps=guide('connected_apps');
      result.sections.apiKeyRotation=guide('api_keys');
      result.sections.passes={status:'not_readable',observed:false,
        note:'Server-issued pass inventory and revocation require authenticated private owner setup; no pass tokens are returned.'};
      result.ownerChecks=Object.keys(result.sections).filter(k=>
        result.sections[k].status==='not_readable');
      result.note='A stored key, connection or endpoint record does not prove account security. 2FA, team roles, invitations and API key rotation require manual Stripe Dashboard checks.';
      return reply(result);
    }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
