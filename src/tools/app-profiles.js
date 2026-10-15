// P-1/P-2: account-specific owner binding, safe profile reads and record URLs.
import {defineWrite,gone} from './write.js';
import {client,allProfiles,fullProfiles,reply,fail} from './billing-shared.js';
import {readVerifiedTestAccount} from '../stripe/test-account.js';
import {resolveAppRecordLink} from '../apps/profiles.js';
const appId={type:'string',pattern:'^[a-z][a-z0-9-]{2,63}$'};
const revision={type:'integer',minimum:1};
const yes={type:'boolean'};
const writeFlags={dryRun:yes,confirm:yes,requestKey:{
  type:'string',minLength:1,maxLength:128}};
function ensureFields(a,required=[],allowed=required){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!allowed.includes(k))||
    required.some(k=>a[k]===undefined))
    throw new TypeError('Unknown or missing project profile fields');
}
const accountOk=ctx=>ctx?.connection?.mode==='test'&&
  /^acct_[A-Za-z0-9]{2,100}$/.test(ctx.connection.stripeAccount??'');
async function verified(ctx){
  if(!accountOk(ctx))throw new TypeError('Selected TEST account required');
  if(!ctx.db?.getKnownApp||!ctx.db?.listKnownAppsForAccount||
    !ctx.db?.bindKnownAppAccount)
    throw new TypeError('Durable app profile registry unavailable');
  const sdk=await client(ctx);
  const account=await readVerifiedTestAccount(sdk,ctx.connection.stripeAccount);
  if(account?.id!==ctx.connection.stripeAccount||account.livemode!==false)
    throw new TypeError('Selected TEST account identity unavailable');
  return sdk;
}
const selected=ctx=>accountOk(ctx);
async function list(a,ctx){
  try{
    ensureFields(a,[],[]);
    await verified(ctx);
    const all=await ctx.db.listKnownApps();
    return reply({account:ctx.connection.stripeAccount,
      scope:await ctx.db.getAppGuardScope(ctx.connection.stripeAccount),
      profiles:all.map(x=>({
        id:x.id,name:x.name,status:x.status,version:x.version,
        boundToSelected:x.profile.stripe_accounts.includes(ctx.connection.stripeAccount),
        metadataKeys:x.profile.metadata_keys.length,
        webhookEvents:x.profile.webhook_events.length
      }))});
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
}
async function get(a,ctx){
  try{
    ensureFields(a,['app'],['app']);
    await verified(ctx);
    const record=await ctx.db.getKnownApp(a.app);
    if(!record)return fail('Unknown application profile');
    return reply({account:ctx.connection.stripeAccount,id:record.id,
      status:record.status,version:record.version,
      isBound:record.profile.stripe_accounts.includes(ctx.connection.stripeAccount),
      profile:{...record.profile,stripe_accounts:undefined},
      accountIdsNotExposed:true});
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
}
async function link(a,ctx){
  try{
    ensureFields(a,['app','metadataKey','value'],['app','metadataKey','value']);
    await verified(ctx);
    const record=await ctx.db.getKnownApp(a.app);
    if(!record||record.status!=='active'||
      !record.profile.stripe_accounts.includes(ctx.connection.stripeAccount))
      return fail('App profile is not assigned to selected TEST account');
    const value=typeof a.value==='string'&&a.value.length<130?a.value:'';
    if(!value)return fail('Exact metadata value required');
    const route=resolveAppRecordLink(record.profile,{key:a.metadataKey,value});
    return route?reply({account:ctx.connection.stripeAccount,
      ...route}):fail('No verified route is declared for that metadata key');
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
}
function bindWrite(){
  let after=null;
  return defineWrite({
    name:'project_bind_profile_account',
    read:async(a,ctx)=>{
      ensureFields(a,['app','expectedVersion','attach'],
        ['app','expectedVersion','attach','dryRun','confirm','requestKey']);
      if(!Number.isSafeInteger(a.expectedVersion)||a.expectedVersion<1||
        typeof a.attach!=='boolean')throw new TypeError('Known revision and binding choice required');
      await verified(ctx);
      const record=await ctx.db.getKnownApp(a.app);
      if(!record||record.status!=='active'||record.version!==a.expectedVersion)
        throw new TypeError('Active project profile revision changed');
      if(record.profile.stripe_accounts.includes(ctx.connection.stripeAccount)===a.attach)
        throw new TypeError('Account binding already in requested state');
      return {id:record.id,metadata:{},version:record.version};
    },
    summarize:(before,a,ctx)=>'TEST account '+ctx.connection.stripeAccount+
      ': '+(a.attach?'bind':'unbind')+' known application '+before.id+
      ' at exact revision '+before.version+
      '. App ownership guard remains in legacy safety mode until separate owner migration.',
    apply:async(a,ctx)=>{
      after=await ctx.db.bindKnownAppAccount({id:a.app,
        account:ctx.connection.stripeAccount,expectedVersion:a.expectedVersion,
        attach:a.attach});
    },
    readAfter:async(a,ctx)=>ctx.db.getKnownApp(a.app),
    verify:(_old,current,a,ctx)=>!!after&&current?.version===after.version&&
      current.profile.stripe_accounts.includes(ctx.connection.stripeAccount)===a.attach
  });
}
function scopeWrite(){
  let done=false;
  return defineWrite({
    name:'project_enable_scoped_ownership',
    read:async(a,ctx)=>{
      ensureFields(a,['acknowledgeScope'],['acknowledgeScope','dryRun','confirm','requestKey']);
      if(a.acknowledgeScope!==true)throw new TypeError(
        'Explicitly acknowledge switching from global legacy guard to per-account app profiles');
      await verified(ctx);
      const scope=await ctx.db.getAppGuardScope(ctx.connection.stripeAccount);
      if(scope!=='legacy')throw new TypeError('Account already uses scoped ownership');
      return {id:ctx.connection.stripeAccount,metadata:{},scope};
    },
    summarize:(before)=>'TEST account '+before.id+
      ': owner switches Stripe app record guard to configured per-account profiles.'+
      ' Any account without a matching active profile will no longer claim app ownership.'+
      ' Reconfirm app bindings before activating.',
    apply:async(_a,ctx)=>{
      done=(await ctx.db.enableScopedAppGuard({
        account:ctx.connection.stripeAccount,expectedScope:'legacy'}))==='scoped';
    },
    readAfter:async(_a,ctx)=>({
      scope:await ctx.db.getAppGuardScope(ctx.connection.stripeAccount)}),
    verify:(_old,after)=>done&&after.scope==='scoped'
  });
}
const bind=bindWrite(),scope=scopeWrite();
export const tools=[
  {name:'project_list_profiles',area:'projects',writes:false,profiles:allProfiles,
    annotations:{readOnlyHint:true},description:'List known project profiles and bindings on selected TEST Stripe account.',
    inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'project_get_profile',area:'projects',writes:false,profiles:allProfiles,
    annotations:{readOnlyHint:true},description:'Get the public app setup contract and version for an existing app.',
    inputSchema:{type:'object',properties:{app:appId},required:['app'],additionalProperties:false}},
  {name:'project_record_link',area:'projects',writes:false,profiles:allProfiles,
    annotations:{readOnlyHint:true},description:'Navigate from a verified metadata key to its known app owner page.',
    inputSchema:{type:'object',properties:{app:appId,metadataKey:{type:'string'},
      value:{type:'string',minLength:1,maxLength:129}},
      required:['app','metadataKey','value'],additionalProperties:false}},
  {...bind.tool,area:'projects',profiles:fullProfiles,
    description:'Confirm attaching or detaching a known app profile to the selected TEST account.',
    inputSchema:{type:'object',properties:{app:appId,expectedVersion:revision,
      attach:yes,...writeFlags},required:['app','expectedVersion','attach'],
      additionalProperties:false}},
  {...scope.tool,area:'projects',profiles:fullProfiles,
    description:'Separate confirmation to activate per-account app profile ownership on TEST only.',
    inputSchema:{type:'object',properties:{acknowledgeScope:yes,...writeFlags},
      required:['acknowledgeScope'],additionalProperties:false}}
];
export const handlers={
  project_list_profiles:list,
  project_get_profile:get,
  project_record_link:link,
  project_bind_profile_account:(a,ctx)=>selected(ctx)?bindWrite().handler(a,ctx):
    gone('TEST app-account binding only'),
  project_enable_scoped_ownership:(a,ctx)=>selected(ctx)?scopeWrite().handler(a,ctx):
    gone('TEST scope migration only')
};
