// H-1: honest own-account Dashboard guidance, real TEST portal/template APIs.
// A connected-account Accounts.update contract never licenses own-account writes.
import {defineWrite,gone} from './write.js';
import {client,allProfiles,fullProfiles,reply,fail,validateFields} from './billing-shared.js';
import {readVerifiedTestAccount,readVerifiedLiveAccount} from '../stripe/test-account.js';
import {assertAccountResourceMode} from './account-mode.js';
import {makeScheduleWrite} from './money-schedule-write.js';

const str=(max=120)=>({type:'string',minLength:1,maxLength:max});
const yes={type:'boolean'};
const resource={type:'string',pattern:'^inr_[A-Za-z0-9]{2,100}$'};
const config={type:'string',pattern:'^bpc_[A-Za-z0-9_]{3,190}$'};
const settingsRoot='https://dashboard.stripe.com/test/settings';
const guideSpec={
  brand_set_account_branding:{
    section:'branding',props:{primaryColor:str(7),secondaryColor:str(7),
      logoFileId:str(110),iconFileId:str(110)},
    steps:['Open Stripe Dashboard in TEST mode and select Business > Branding.',
      'Review the requested colors and uploaded business images; save manually.',
      'Reopen the exact setting and compare its observed values.'],
    observed:a=>({primaryColor:a.settings?.branding?.primary_color??null,
      secondaryColor:a.settings?.branding?.secondary_color??null,
      logoFileId:typeof a.settings?.branding?.logo==='string'?a.settings.branding.logo:null,
      iconFileId:typeof a.settings?.branding?.icon==='string'?a.settings.branding.icon:null})},
  brand_set_statement_descriptor:{
    section:'account',props:{descriptor:str(22),cardPrefix:str(10)},
    steps:['Open TEST Dashboard > Business > Public details.',
      'Enter the desired statement descriptor and optional card prefix, then save.',
      'Compare the value against a fresh TEST account read; bank displays may lag.'],
    observed:a=>({descriptor:a.settings?.payments?.statement_descriptor??null,
      cardPrefix:a.settings?.card_payments?.statement_descriptor_prefix??null})},
  brand_set_public_details:{
    section:'account',props:{businessName:str(150),supportEmail:str(254),
      supportPhone:str(32),website:str(300)},
    steps:['Open Stripe TEST Dashboard > Business > Public details.',
      'Review and enter the requested public business/contact information; save.',
      'Read the TEST account again to verify each field actually changed.'],
    observed:a=>({businessName:a.business_profile?.name??null,
      supportEmail:a.business_profile?.support_email??null,
      supportPhone:a.business_profile?.support_phone??null,
      website:a.business_profile?.url??null})},
  brand_set_invoice_defaults:{
    section:'billing',props:{footer:str(500),memo:str(500),
      paymentTermsDays:{type:'integer',minimum:1,maximum:365},
      numberingPrefix:str(20)},
    steps:['Open Stripe TEST Dashboard > Billing > Invoices > Settings.',
      'Review footer, memo, terms and invoice numbering; save permitted settings.',
      'Inspect a newly drafted TEST invoice before declaring rendering accepted.'],
    observed:_a=>({status:'dashboard_or_invoice_readback_required'})},
  setup_set_card_safety:{
    section:'payments',props:{declineWrongZip:yes,declineWrongCvc:yes},
    steps:['Open Stripe TEST Dashboard > Payments > Radar > Rules or Card settings.',
      'Choose the requested address/CVC declines, if supported by the account.',
      'Read current account card-payment settings again for actual observed values.'],
    observed:a=>({declineWrongZip:a.settings?.card_payments?.decline_on?.avs_failure??null,
      declineWrongCvc:a.settings?.card_payments?.decline_on?.cvc_failure??null})},
  setup_set_dashboard_timezone:{
    section:'account',props:{timezone:{type:'string',enum:['America/Denver']}},
    steps:['Open TEST Dashboard > Profile > Preferences > Time zone.',
      'Select America/Denver (Mountain Time) and save using your owner session.',
      'Read the account timezone independently; if unavailable, keep unverified.'],
    observed:a=>({timezone:a.settings?.dashboard?.timezone??null})}
};
const validId=(v,p)=>typeof v==='string'&&
  new RegExp('^'+p+'_[A-Za-z0-9_]{2,190}$').test(v);
const selected=ctx=>ctx?.connection?.mode==='test'&&
  /^acct_[A-Za-z0-9]{2,100}$/.test(ctx.connection.stripeAccount??'');
// The payout schedule converted with the Money family (owner-obedience
// V2 family 1, coordinator ruling 6): this exposure admits both modes
// on a selected account. The Branding family (V2 family 11) now uses
// the same either-mode selector for the invoice-template and portal
// writes; the guided handlers and template reads keep the TEST-only
// selector above.
const selectedEitherMode=ctx=>['test','live'].includes(ctx?.connection?.mode)&&
  /^acct_[A-Za-z0-9]{2,100}$/.test(ctx.connection.stripeAccount??'');
async function testAccount(ctx){
  if(!selected(ctx))throw new TypeError('Exact selected TEST account required');
  const s=await client(ctx);
  const account=await readVerifiedTestAccount(s,ctx.connection.stripeAccount);
  if(account?.id!==ctx.connection.stripeAccount||account?.livemode!==false)
    throw new TypeError('Selected own TEST account unverified');
  return {s,account};
}
// Mode-aware account verification for the converted branding writes
// (owner-obedience V2 family 11): the same exact-identity proof as
// testAccount, with the independent provider mode evidence demanded
// for the connection's own mode in both directions. The guided
// handlers and the template reads keep testAccount (TEST-only).
async function modeAccount(ctx){
  if(!selectedEitherMode(ctx))
    throw new TypeError('Exact selected account required');
  const s=await client(ctx);
  const live=ctx.connection.mode==='live';
  const account=live?
    await readVerifiedLiveAccount(s,ctx.connection.stripeAccount):
    await readVerifiedTestAccount(s,ctx.connection.stripeAccount);
  if(account?.id!==ctx.connection.stripeAccount||account?.livemode!==live)
    throw new TypeError('Selected own '+(live?'LIVE':'TEST')+' account unverified');
  return {s,account};
}
function validateGuide(name,a){
  const spec=guideSpec[name];
  validateFields(a,spec.props,[]);
  const fields=Object.keys(a).filter(k=>!['dryRun','confirm','requestKey'].includes(k));
  if(!fields.length)throw new TypeError('Select at least one setting to review');
  for(const k of fields){
    const v=a[k];
    if(typeof v==='string'){
      if(['primaryColor','secondaryColor'].includes(k)&&!/^#[0-9a-fA-F]{6}$/.test(v))
        throw new TypeError('Choose a six-digit hex color');
      if(['logoFileId','iconFileId'].includes(k)&&!validId(v,'file'))
        throw new TypeError('Choose a verified Stripe business image file');
      if(['website'].includes(k)&&!publicUrl(v))throw new TypeError('Choose a safe public website URL');
      if(['supportEmail'].includes(k)&&!/^\S+@\S+\.\S+$/.test(v))
        throw new TypeError('Choose a valid support email');
      if(['descriptor','cardPrefix'].includes(k)&&
        (k==='descriptor'&&(v.length<5||v.length>22||!/[A-Za-z]/.test(v)||
          /[<>\\'"*]/.test(v))))
        throw new TypeError('Stripe statement descriptor requires 5–22 safe characters and a letter');
    }
  }
}
function publicUrl(raw){
  try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&
    !u.hash&&!u.port&&u.hostname.includes('.')&&
    u.hostname!=='localhost'&&!u.hostname.endsWith('.localhost')&&
    !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname);}
  catch{return false;}
}
function observedGuide(name,desired,account){
  const spec=guideSpec[name],observed=spec.observed(account);
  const exact=Object.entries(desired).every(([k,v])=>observed[k]===v);
  return {observed,comparison:spec.section==='billing'?'not_readable':
    exact?'matches_requested_values':'not_confirmed'};
}
async function guide(name,a,ctx){
  try{
    validateGuide(name,a);
    const {account}=await testAccount(ctx);
    const safe=Object.fromEntries(Object.entries(a).filter(([k])=>
      !['confirm','dryRun','requestKey'].includes(k)));
    const spec=guideSpec[name],observation=observedGuide(name,safe,account);
    return reply({done:false,account:ctx.connection.stripeAccount,mode:'test',
      requested:safe,...observation,changeMade:false,
      requiresOwnerAction:true,ownerConfirmed:false,
      manualSettingsUrl:settingsRoot,
      steps:spec.steps,verifyWith:name,
      note:'No own-account API mutation was attempted. Readback is an observation, not proof of who changed it.'});
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
}
const guideTools=Object.entries(guideSpec).map(([name,spec])=>({
  name,area:'branding',profiles:fullProfiles,writes:false,
  annotations:{readOnlyHint:true},
  description:'Inspect requested TEST own-account settings and return safe Dashboard steps; never claim a write.',
  inputSchema:{type:'object',properties:spec.props,additionalProperties:false}
}));
function safeTemplate(t){
  if(!validId(t?.id,'inr')||t?.object!=='invoice_rendering_template')
    throw new TypeError('Invoice rendering template identity unavailable');
  return {id:t.id,status:t.status??null,nickname:t.nickname??null,
    created:t.created??null,livemode:t.livemode??null};
}
function checkedPage(a){
  if(a===undefined)a={};
  if(!a||Array.isArray(a)||typeof a!=='object'||
    Object.keys(a).some(k=>!['limit','starting_after'].includes(k))||
    (a.limit!==undefined&&(!Number.isInteger(a.limit)||a.limit<1||a.limit>50))||
    (a.starting_after!==undefined&&!validId(a.starting_after,'inr')))
    throw new TypeError('Choose valid invoice template pagination');
  return {limit:a.limit??20,...(a.starting_after?{starting_after:a.starting_after}:{})};
}
async function templateList(a,ctx){
  try{
    const page=checkedPage(a),{s}=await testAccount(ctx);
    const response=await s.invoiceRenderingTemplates.list(page);
    if(!Array.isArray(response?.data)||typeof response.has_more!=='boolean')
      throw new TypeError('Template page incomplete');
    const list=response.data.map(safeTemplate);
    return reply({account:ctx.connection.stripeAccount,data:list,
      hasMore:response.has_more,next:response.has_more?list.at(-1)?.id??null:null});
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
}
async function templateGet(a,ctx){
  try{
    if(!a||Object.keys(a).some(k=>k!=='templateId')||
      !validId(a.templateId,'inr'))throw new TypeError('Invoice template ID required');
    const {s}=await testAccount(ctx);
    return reply({account:ctx.connection.stripeAccount,
      template:safeTemplate(await s.invoiceRenderingTemplates.retrieve(a.templateId))});
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
}
function templateWrite(name,action){
  let expectedId=null;
  return defineWrite({
    name,
    read:async(a,ctx)=>{
      const checked={...a};delete checked.previewFingerprint;
      validateFields(checked,{templateId:resource,outsideApp:yes},['templateId']);
      const {s}=await modeAccount(ctx);
      const original=await s.invoiceRenderingTemplates.retrieve(a.templateId);
      safeTemplate(original);
      assertAccountResourceMode(original,ctx.connection.mode);
      if(action==='archive'&&original.status==='archived')
        throw new TypeError('Rendering template already archived');
      if(action==='unarchive'&&original.status==='active')
        throw new TypeError('Rendering template already active');
      return {...original,metadata:original.metadata??{}};
    },
    summarize:(before,_a,ctx)=>ctx?.connection?.mode==='live'?
      'LIVE MODE: '+action+' exact invoice template '+before.id+
      ' after explicit confirmation; '+(action==='archive'?
        'it stops being available for new real invoices':
        'it becomes available again for new real invoices')+
      '; no existing invoices are edited.':
      'TEST MODE: '+action+' exact invoice template '+before.id+
      ' after explicit confirmation; no existing invoices are edited.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const {s}=await modeAccount(ctx);
      const result=await s.invoiceRenderingTemplates[action](a.templateId,{},{
        idempotencyKey});
      if(result?.id!==a.templateId)throw new TypeError('Template mutation identity mismatch');
      expectedId=result.id;
    },
    readAfter:async(_a,ctx)=>expectedId?
      (await client(ctx)).invoiceRenderingTemplates.retrieve(expectedId):null,
    verify:(_before,after,a,ctx)=>after?.id===a.templateId&&
      after.status===(action==='archive'?'archived':'active')&&
      (after.livemode===undefined||
        after.livemode===(ctx?.connection?.mode==='live'))
  });
}
function portalLook(){
  let last=null;
  const keys=['headline','privacyUrl','termsUrl','defaultReturnUrl'];
  const props={configId:config,headline:str(120),privacyUrl:str(500),
    termsUrl:str(500),defaultReturnUrl:str(500),outsideApp:yes};
  return defineWrite({
    name:'brand_set_portal_look',
    read:async(a,ctx)=>{
      const checked={...a};delete checked.previewFingerprint;
      validateFields(checked,props,['configId']);
      if(!keys.some(k=>a[k]!==undefined))
        throw new TypeError('Choose a portal appearance field');
      for(const k of ['privacyUrl','termsUrl','defaultReturnUrl'])
        if(a[k]!==undefined&&!publicUrl(a[k]))
          throw new TypeError('Only safe public HTTPS portal links are permitted');
      if(a.defaultReturnUrl!==undefined){
        const approved=ctx.services?.hostedReturnUrls?.portal;
        if(typeof approved!=='string'||a.defaultReturnUrl!==approved)
          throw new TypeError('Portal return destination must match owner-configured HTTPS redirect');
      }
      const {s}=await modeAccount(ctx),config=await s.billingPortal.configurations.retrieve(a.configId);
      if(config?.id!==a.configId||config?.active!==true)
        throw new TypeError('Active owned portal configuration required');
      assertAccountResourceMode(config,ctx.connection.mode);
      // Stripe's Portal configuration has no reliable MCP-created marker.
      // Where any active project is bound, the account's Portal could be app
      // managed. Refuse even an outsideApp override until ownership is proven.
      if(typeof ctx.db?.listKnownAppsForAccount!=='function')
        throw new TypeError('Portal app ownership registry unavailable');
      const apps=await ctx.db.listKnownAppsForAccount(ctx.connection.stripeAccount);
      if(!Array.isArray(apps)||apps.some(app=>app?.status==='active'))
        throw new TypeError('App-bound TEST Portal ownership cannot be proven; use Dashboard review');
      return {...config,metadata:config.metadata??{}};
    },
    summarize:(before,a,ctx)=>ctx?.connection?.mode==='live'?
      'LIVE MODE: change portal appearance for '+before.id+
      ' fields '+keys.filter(k=>a[k]!==undefined).join(', ')+
      '; these become publicly visible to real customers in the customer portal immediately'+
      '; no profiled-app Checkout or account-wide branding is changed.':
      'TEST MODE: change portal appearance for '+before.id+
      ' fields '+keys.filter(k=>a[k]!==undefined).join(', ')+
      '; no profiled-app Checkout or account-wide branding is changed.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const {s}=await modeAccount(ctx);
      const profile={
        ...(a.headline!==undefined?{headline:a.headline}:{}),
        ...(a.privacyUrl!==undefined?{privacy_policy_url:a.privacyUrl}:{}),
        ...(a.termsUrl!==undefined?{terms_of_service_url:a.termsUrl}:{})
      };
      const result=await s.billingPortal.configurations.update(a.configId,{
        ...(Object.keys(profile).length?{business_profile:profile}:{}),
        ...(a.defaultReturnUrl?{default_return_url:a.defaultReturnUrl}:{})
      },{idempotencyKey});
      if(result.id!==a.configId)throw new TypeError('Portal configuration identity mismatch');
      last=result.id;
    },
    readAfter:async(_a,ctx)=>last?
      (await client(ctx)).billingPortal.configurations.retrieve(last):null,
    verify:(_before,after,a,ctx)=>after?.id===a.configId&&after.active===true&&
      (after.livemode===undefined||
        after.livemode===(ctx?.connection?.mode==='live'))&&
      (a.headline===undefined||after.business_profile?.headline===a.headline)&&
      (a.privacyUrl===undefined||after.business_profile?.privacy_policy_url===a.privacyUrl)&&
      (a.termsUrl===undefined||after.business_profile?.terms_of_service_url===a.termsUrl)&&
      (a.defaultReturnUrl===undefined||after.default_return_url===a.defaultReturnUrl)
  });
}
const arch=templateWrite('brand_archive_invoice_template','archive');
const unarch=templateWrite('brand_unarchive_invoice_template','unarchive');
const portal=portalLook();
const schedule=makeScheduleWrite();
const request={type:'string',minLength:1,maxLength:128};
const writeProps={dryRun:yes,confirm:yes,requestKey:request,
  previewFingerprint:{type:'string',maxLength:64}};
const templateSchema={type:'object',properties:{templateId:resource,outsideApp:yes,...writeProps},
  required:['templateId'],additionalProperties:false};
export const tools=[
  ...guideTools,
  {name:'brand_list_invoice_templates',area:'branding',profiles:allProfiles,writes:false,
    annotations:{readOnlyHint:true},
    description:'List bounded TEST Stripe invoice rendering templates and observed archive status.',
    inputSchema:{type:'object',properties:{limit:{type:'integer',minimum:1,maximum:50},
      starting_after:resource},additionalProperties:false}},
  {name:'brand_get_invoice_template',area:'branding',profiles:allProfiles,writes:false,
    annotations:{readOnlyHint:true},
    description:'Read safe selected TEST Stripe invoice rendering template identity and status.',
    inputSchema:{type:'object',properties:{templateId:resource},
      required:['templateId'],additionalProperties:false}},
  {...arch.tool,area:'branding',profiles:fullProfiles,
    description:'Preview and explicitly archive a selected invoice template with readback.',
    inputSchema:templateSchema},
  {...unarch.tool,area:'branding',profiles:fullProfiles,
    description:'Preview and explicitly restore a selected invoice template with readback.',
    inputSchema:templateSchema},
  {...portal.tool,area:'branding',profiles:fullProfiles,
    description:'Guardedly change portal headline and public policy/return URLs in the connection mode; verify.',
    inputSchema:{type:'object',properties:{configId:config,
      headline:str(120),privacyUrl:str(500),termsUrl:str(500),
      defaultReturnUrl:str(500),outsideApp:yes,...writeProps},
      required:['configId'],additionalProperties:false}},
  {...schedule.tool,name:'setup_set_payout_schedule',area:'branding',profiles:fullProfiles,
    description:'Use guarded payout-schedule update in the connection mode with own-account fallback steps.',
    inputSchema:schedule.tool.inputSchema}
];
export const handlers={
  ...Object.fromEntries(Object.keys(guideSpec).map(name=>[name,
    (a,ctx)=>selected(ctx)?guide(name,a,ctx):gone('TEST own-account guidance only')])),
  brand_list_invoice_templates:templateList,
  brand_get_invoice_template:templateGet,
  brand_archive_invoice_template:(a,ctx)=>selectedEitherMode(ctx)?
    templateWrite('brand_archive_invoice_template','archive').handler(a,ctx):
    gone('Invoice template requires a selected account'),
  brand_unarchive_invoice_template:(a,ctx)=>selectedEitherMode(ctx)?
    templateWrite('brand_unarchive_invoice_template','unarchive').handler(a,ctx):
    gone('Invoice template requires a selected account'),
  brand_set_portal_look:(a,ctx)=>selectedEitherMode(ctx)?portalLook().handler(a,ctx):
    gone('Portal configuration requires a selected account'),
  setup_set_payout_schedule:(a,ctx)=>selectedEitherMode(ctx)?
    makeScheduleWrite().handler(a,ctx):
    gone('Payout schedule requires a selected account')
};
