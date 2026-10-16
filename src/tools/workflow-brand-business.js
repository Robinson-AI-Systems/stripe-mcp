// W-10: owner-facing brand workflow using only original native TEST tools.
// Every provider write is separately previewed and confirmed; an owner-Dashboard
// setting is never reported changed by a read-only guided instruction.
import {createHash} from 'node:crypto';
import {validateBrandKit} from '../brand/store.js';
import {allProfiles,reply,fail} from './billing-shared.js';
import {nativeRead,verifyContext,collect,deadline} from './workflow-read-common.js';
import {writable,nativeWrite,readyStep} from './workflow-customer-actions.js';
const id=(p)=>({type:'string',pattern:'^'+p+'_[A-Za-z0-9_]{3,190}$'});
const properties={
  brandKit:{type:'object'},accountBranding:{type:'object'},
  statement:{type:'object'},publicDetails:{type:'object'},
  invoiceDefaults:{type:'object'},portalLook:{type:'object'},
  customerId:id('cus'),priceId:id('price'),checkoutSessionId:id('cs_test'),
  outsideApp:{type:'boolean'},
  confirm:{type:'boolean'},dryRun:{type:'boolean'},
  previewToken:{type:'string',pattern:'^[a-f0-9]{64}$'},
  requestKey:{type:'string',minLength:1,maxLength:100}
};
export const tools=[{
  name:'workflow_brand_business',area:'workflows',writes:true,
  profiles:['full'],writeContract:'defineWrite-v1',safety:'P',moneySpec:null,
  description:'Finish TEST business brand kit, owner Dashboard actions and guarded hosted Checkout one safe stage at a time.',
  inputSchema:{type:'object',properties,additionalProperties:false}
}];
const guided=Object.freeze({
  accountBranding:'brand_set_account_branding',
  statement:'brand_set_statement_descriptor',
  publicDetails:'brand_set_public_details',
  invoiceDefaults:'brand_set_invoice_defaults'
});
const publicUrl=value=>{
  if(typeof value!=='string'||value.length>500)return false;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&
    !u.password&&!u.hash&&!u.port&&u.hostname.includes('.');}catch{return false;}
};
function validate(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!Object.hasOwn(properties,k)))
    throw new TypeError('Only supported TEST branding workflow fields accepted');
  if(a.brandKit!==undefined)validateBrandKit(a.brandKit);
  for(const key of [...Object.keys(guided),'portalLook']){
    const p=a[key];
    if(p!==undefined&&(!p||typeof p!=='object'||Array.isArray(p)||!Object.keys(p).length))
      throw new TypeError('Brand settings must be nonempty documented fields');
  }
  if(a.portalLook!==undefined){
    const p=a.portalLook;
    if(!/^bpc_[A-Za-z0-9_]{3,190}$/.test(p.configId??'')||
      Object.keys(p).some(k=>!['configId','headline','privacyUrl',
        'termsUrl','defaultReturnUrl'].includes(k))||
      !Object.keys(p).some(k=>k!=='configId'))
      throw new TypeError('Exact portal configuration and appearance fields required');
    for(const k of ['privacyUrl','termsUrl','defaultReturnUrl'])
      if(p[k]!==undefined&&!publicUrl(p[k]))
        throw new TypeError('Only verified HTTPS public Portal links permitted');
  }
  if(a.customerId!==undefined&&!/^cus_[A-Za-z0-9_]{3,190}$/.test(a.customerId)||
    a.priceId!==undefined&&!/^price_[A-Za-z0-9_]{3,190}$/.test(a.priceId)||
    Boolean(a.customerId)!==Boolean(a.priceId)||
    a.checkoutSessionId!==undefined&&!/^cs_test_[A-Za-z0-9_]{3,190}$/.test(a.checkoutSessionId))
    throw new TypeError('Select exact TEST customer+price together and optional prior Checkout session');
  if(a.confirm===true&&(!a.previewToken||!a.requestKey||a.dryRun===true))
    throw new TypeError('Fresh selected TEST stage preview and stable requestKey required');
}
const canonical=v=>JSON.stringify(v??{},Object.keys(v??{}).sort());
const hash=(ctx,a,snapshot,child)=>createHash('sha256').update(JSON.stringify({
  account:ctx.connection.stripeAccount,kind:'brand-business',
  request:Object.fromEntries(Object.entries(a).filter(([k])=>
    !['confirm','dryRun','previewToken','requestKey'].includes(k))),
  snapshot,child
})).digest('hex');
async function desiredStage(a,ctx){
  verifyContext(ctx);validate(a);
  const state=await nativeRead('brand_get',{},ctx);
  if(state.account!==ctx.connection.stripeAccount||state.mode!=='test'||
    !Number.isSafeInteger(state.version)||state.version<0)
    throw new TypeError('Original TEST brand kit identity/revision unavailable');
  const guidedRows=[];
  for(const [key,tool] of Object.entries(guided)){
    if(a[key]===undefined)continue;
    const row=await nativeRead(tool,a[key],ctx);
    if(row.account!==ctx.connection.stripeAccount||row.mode!=='test'||
      row.changeMade!==false)
      throw new TypeError('Original owner setting verification unavailable');
    guidedRows.push({setting:key,status:row.comparison==='matches_requested_values'?
      'done':'needs_you',observed:row.observed??null,
      ...(row.comparison!=='matches_requested_values'?{
        settingsUrl:row.manualSettingsUrl,steps:row.steps,
        ownerAction:'Apply and independently verify in own Stripe TEST Dashboard'}:{})});
  }
  if(a.brandKit!==undefined&&canonical(validateBrandKit(a.brandKit))!==
    canonical(validateBrandKit(state.kit??{})))
    return {state,guidedRows,stage:{tool:'brand_save_kit',
      args:{kit:a.brandKit,expectedVersion:state.version}},step:'brandKit'};
  if(a.portalLook!==undefined){
    const p=a.portalLook,portal=await nativeRead('portal_get_configuration',
      {configId:p.configId},ctx);
    if(portal.id!==p.configId||portal.active!==true)
      throw new TypeError('Selected TEST Portal configuration unavailable or disabled');
    const keys={headline:'headline',privacyUrl:'privacyUrl',termsUrl:'termsUrl',
      defaultReturnUrl:'defaultReturnUrl'};
    if(Object.entries(keys).some(([k,x])=>p[k]!==undefined&&
      (x==='defaultReturnUrl'?portal.defaultReturnUrl:portal.appearance?.[x])!==p[k]))
      return {state,guidedRows,stage:{tool:'brand_set_portal_look',
        args:p},step:'portalLook',portal};
  }
  if(a.customerId&&a.priceId){
    const [customer,price]=await Promise.all([
      nativeRead('customer_get',{customerId:a.customerId},ctx),
      nativeRead('price_get',{priceId:a.priceId},ctx)
    ]);
    if(customer.id!==a.customerId||customer.deleted===true||
      price.id!==a.priceId||price.active!==true||price.currency!=='usd')
      throw new TypeError('Original verified TEST customer or active USD price unavailable');
    if(a.checkoutSessionId){
      const session=await nativeRead('checkout_get',{sessionId:a.checkoutSessionId},ctx);
      const lines=await collect('checkout_list_line_items',
        {sessionId:a.checkoutSessionId,limit:100},ctx,{end:deadline()});
      if(session.id!==a.checkoutSessionId||session.mode!=='payment'||
        session.customer!==customer.id||session.status!=='open'||
        !publicUrl(session.url)||!lines.complete||
        !lines.data.some(l=>l.price===price.id))
        throw new TypeError('Previously created guarded TEST Checkout cannot be verified');
      return {state,guidedRows,checkout:{sessionId:session.id,url:session.url,
        verified:true,reused:true}};
    }
    return {state,guidedRows,stage:{tool:'brand_preview_checkout',
      args:{customerId:customer.id,priceId:price.id,
        ...(a.outsideApp!==undefined?{outsideApp:a.outsideApp}:{})}},
      step:'checkout',source:{customer:customer.id,price:price.id}};
  }
  return {state,guidedRows,stage:null,step:'owner_actions'};
}
async function run(a,ctx){
  writable(ctx);validate(a);
  const source=await desiredStage(a,ctx),pending=source.guidedRows.filter(x=>x.status!=='done');
  const result={kind:'brand_business',account:ctx.connection.stripeAccount,mode:'test',
    kitVersion:source.state.version,accountBranding:source.state.accountBranding,
    guidedSettings:source.guidedRows,
    needsOwner:pending.map(x=>x.setting),
    appCreatedPagesAffected:false,anyLiveWrite:false,
    brandingStage:source.step??'complete',
    checkout:source.checkout??null,
    checkoutVerified:source.checkout?.verified===true,
    done:source.checkout?.verified===true&&pending.length===0,
    nextAction:source.checkout?.verified?'Verified original TEST Checkout reused without provider write':
      !source.stage?'Finish owner Dashboard actions and supply exact customer+price to generate TEST Checkout':
      'Review separately guarded '+source.step+' native preview and explicitly confirm',
    note:'Dashboard-only account branding, descriptors/public details and invoice defaults are never silently changed.'};
  if(!source.stage)return {...result,noProviderWrite:true};
  const original=await readyStep(source.stage.tool,source.stage.args,ctx);
  const digest=hash(ctx,a,{
    brand:source.state,guide:source.guidedRows,portal:source.portal??null,
    checkout:source.source??null},original.preview);
  const staged={...result,nativeTool:source.stage.tool,
    nativePreview:original.preview,previewToken:digest,needsConfirmation:true};
  if(a.confirm!==true)return staged;
  if(a.previewToken!==digest)
    throw new TypeError('TEST branding/Portal/Checkout state changed; preview again');
  try{
    const out=await nativeWrite(source.stage.tool,{
      ...source.stage.args,confirm:true,
      requestKey:a.requestKey+':'+source.step},ctx);
    if(out.isError||out.value.done!==true||out.value.confirmed!==true)
      return {...staged,done:false,confirmed:false,needsConfirmation:false,
        warning:'Native guarded step denied or uncertain; inspect original audit, do not automatically retry'};
    if(source.step==='checkout'){
      const id=out.value.resourceId,session=await nativeRead('checkout_get',
        {sessionId:id},ctx);
      if(session.id!==id||session.customer!==a.customerId||
        session.mode!=='payment'||!publicUrl(session.url)||session.url!==out.value.url)
        throw new TypeError('Created TEST hosted Checkout link not independently verified');
      return {...staged,done:pending.length===0,confirmed:true,
        needsConfirmation:false,checkoutVerified:true,
        checkout:{sessionId:id,url:session.url,verified:true,reused:false},
        nextAction:pending.length?'Owner must still verify Dashboard-only settings':
          'TEST Checkout link verified; next identical run supply checkoutSessionId to reuse'};
    }
    return {...staged,done:false,confirmed:true,needsConfirmation:false,
      nextAction:source.step==='brandKit'?'Kit confirmed: call again to preview Portal or Checkout':
        'Portal confirmed: call again to preview TEST Checkout',
      note:'One original guarded native step confirmed; no later action was automatically assumed or executed'};
  }catch{return {...staged,done:false,confirmed:false,needsConfirmation:false,
    warning:'Native brand stage could have succeeded: inspect protected audit and exact state before retry'};}
}
export const handlers={async workflow_brand_business(a,ctx){
  try{return reply(await run(a,ctx));}
  catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
}};
