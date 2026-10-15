// P-4: user-supplied facts only. A draft does not grant access or activate ownership.
import {createHash} from 'node:crypto';
import {validateProfile} from '../apps/profiles.js';
const fail=x=>{throw new TypeError(x);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const id=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{2,63}$/.test(x);
const text=(x,max=140)=>typeof x==='string'&&x.trim()&&x.length<=max&&
  !/[\r\n\x00-\x1f<>{}]/.test(x);
const unique=(v,max,test,label)=>{
  if(!Array.isArray(v)||v.length>max||new Set(v).size!==v.length||
    v.some(x=>!test(x)))fail('Invalid/duplicate '+label);
  return [...v];
};
const metadata=x=>typeof x==='string'&&/^[A-Za-z][A-Za-z0-9_]{1,63}$/.test(x);
const call=x=>typeof x==='string'&&/^[a-z][A-Za-z0-9_.]{2,90}$/.test(x);
const methods=['card','us_bank_account'],modes=['payment','setup','subscription'];
const events=new Set([
  'customer.created','customer.updated','customer.deleted',
  'checkout.session.completed','checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed','payment_intent.created',
  'payment_intent.succeeded','payment_intent.payment_failed','payment_intent.canceled',
  'invoice.created','invoice.updated','invoice.finalized','invoice.paid',
  'invoice.payment_failed','invoice.voided','invoice.marked_uncollectible',
  'charge.succeeded','charge.updated','charge.refunded','charge.dispute.created',
  'customer.subscription.created','customer.subscription.updated',
  'customer.subscription.deleted','product.created','product.updated',
  'price.created','price.updated','payment_method.attached',
  'payment_method.updated','payment_method.detached','setup_intent.created',
  'setup_intent.succeeded','setup_intent.canceled'
]);
function web(value,label){
  let u;try{u=new URL(value);}catch{}
  if(!u||u.protocol!=='https:'||u.username||u.password||u.port||u.hash||
    u.search||!u.hostname.includes('.')||u.hostname==='localhost'||
    /(?:^|\.)localhost$/.test(u.hostname)||!text(value,300))
    fail('An explicit safe HTTPS '+label+' is required');
  return u;
}
function keys(value){
  if(!obj(value)||Object.keys(value).some(k=>!['read','write'].includes(k)))
    fail('Explicit restricted-key permission lists required');
  return Object.fromEntries(['read','write'].map(k=>[k,unique(value[k]??[],45,
    x=>typeof x==='string'&&/^[a-z][a-z0-9_]{1,59}$/.test(x),k+' permissions')]));
}
function portal(value){
  const names=['allow_cancel','allow_plan_switch','allow_payment_method_update',
    'allow_invoice_history'];
  if(!obj(value)||Object.keys(value).length!==4||
    names.some(k=>typeof value[k]!=='boolean')||
    Object.keys(value).some(k=>!names.includes(k)))
    fail('Explicit complete Portal permission choices required');
  return Object.fromEntries(names.map(k=>[k,value[k]]));
}
function eventList(input){
  const all=unique(input,25,x=>typeof x==='string'&&
    /^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,75}$/.test(x),'webhook events');
  return {recognized:all.filter(e=>events.has(e)),
    unrecognized:all.filter(e=>!events.has(e))};
}
const recordLinks=value=>{
  if(value===undefined)return {};
  if(!obj(value)||Object.keys(value).length>30)fail('Invalid record link mappings');
  return Object.fromEntries(Object.entries(value).map(([k,v])=>{
    if(!metadata(k)||!obj(v)||Object.keys(v).some(p=>!['landing','detail'].includes(p)))
      fail('Invalid record link mapping');
    return [k,{...v}];
  }));
};
function profileOf(f){
  const source='docs/APP-NEEDS-'+f.id.toUpperCase()+'.md';
  return validateProfile({
    id:f.id,name:f.name,base_url:f.website,
    stripe_accounts:[],metadata_keys:f.metadataKeys,webhook_url:f.webhookUrl??f.website,
    webhook_events:f.webhookEvents,key_permissions:f.keyPermissions,
    owns_catalog:f.ownsCatalog,owns_tax_rates:f.ownsTaxRates,
    portal_rules:f.portalRules,payment_methods:f.paymentMethods,
    checkout_modes:f.checkoutModes,record_links:f.recordLinks,
    dashboard_settings:{},needs_rows:Array.from({length:21},(_,i)=>'S'+(i+1)),
    source
  });
}
export function draftFromFindings(input){
  if(!obj(input)||Object.keys(input).some(k=>![
    'id','name','website','webhookUrl','webhookEvents','metadataKeys',
    'stripeCalls','checkoutModes','paymentMethods','ownsCatalog','ownsTaxRates',
    'keyPermissions','portalRules','recordLinks'].includes(k))||
    !id(input.id)||!text(input.name)||!text(input.website,300))
    fail('Identify a new project with explicit structured code findings');
  const website=web(input.website,'project origin').origin;
  if(website!==input.website)fail('Use canonical HTTPS website origin');
  const webhookUrl=input.webhookUrl?web(input.webhookUrl,'webhook destination').href:null;
  const discovered=eventList(input.webhookEvents??[]);
  const metadataKeys=unique(input.metadataKeys??[],80,metadata,'metadata keys');
  const calls=unique(input.stripeCalls??[],100,call,'observed Stripe calls');
  const checkoutModes=unique(input.checkoutModes??[],3,x=>modes.includes(x),
    'Checkout modes');
  const paymentMethods=unique(input.paymentMethods??[],2,x=>methods.includes(x),
    'payment methods');
  if(typeof input.ownsCatalog!=='boolean'||typeof input.ownsTaxRates!=='boolean')
    fail('Confirm whether the project owns its catalog and tax rates');
  const p=portal(input.portalRules);
  const record=recordLinks(input.recordLinks);
  if(Object.keys(record).some(k=>!metadataKeys.includes(k)))
    fail('A record link requires its declared app ownership marker');
  const permissions=keys(input.keyPermissions);
  const missing=[];
  if(discovered.unrecognized.length)missing.push('Verify unsupported/unrecognized webhook event names against Stripe before creating endpoints: '+
    discovered.unrecognized.join(', '));
  if(discovered.recognized.length&&!webhookUrl)missing.push('Provide exact deployed HTTPS webhook destination');
  if(!paymentMethods.length)missing.push('Choose explicit payment methods');
  if(!checkoutModes.length)missing.push('Choose exact Checkout modes from code');
  if(Object.keys(record).length!==metadataKeys.length&&metadataKeys.length)
    missing.push('Verify app-owned record navigation paths; unspecified links are intentionally absent');
  if(!permissions.read.length&&!permissions.write.length)
    missing.push('Owner must verify app restricted-key permissions; none inferred from call strings');
  const f={
    id:input.id,name:input.name,website,webhookUrl,
    webhookEvents:discovered.recognized,metadataKeys,
    stripeCalls:calls,checkoutModes,paymentMethods,
    ownsCatalog:input.ownsCatalog,ownsTaxRates:input.ownsTaxRates,
    keyPermissions:permissions,portalRules:p,recordLinks:record
  };
  // Profile is a draft. Unknown events are NOT promoted to provider configuration.
  return {profile:profileOf(f),unrecognizedEvents:discovered.unrecognized,
    missing,observedStripeCalls:calls,
    status:'draft',active:false,accountBound:false};
}
export function appNeeds(draft){
  const p=draft.profile;
  const lines=[
    '# APP-NEEDS — '+p.name,'',
    'Status: DRAFT — requires owner review; never activates app ownership or credentials.',
    'Project ID: '+p.id,
    'Website: '+p.base_url,
    'Webhook destination: '+(draft.unrecognizedEvents.length?
      'UNVERIFIED — unresolved event types':' '+(p.webhook_events.length?p.webhook_url:'none selected')),
    'Own catalog: '+p.owns_catalog+'; own tax rates: '+p.owns_tax_rates,'',
    '## Observed Stripe calls (not an API permission grant)',
    ...(draft.observedStripeCalls.length?draft.observedStripeCalls.map(x=>'- \`'+x+'\`'):['- Not supplied']),
    '','## Webhook events',
    ...(p.webhook_events.length?p.webhook_events.map(x=>'- \`'+x+'\`'):['- None selected']),
    '','## Ownership metadata markers',
    ...(p.metadata_keys.length?p.metadata_keys.map(x=>'- \`'+x+'\`'):['- None declared']),
    '','## Payment methods / Checkout',
    '- Methods: '+(p.payment_methods.join(', ')||'not selected'),
    '- Modes: '+(p.checkout_modes.join(', ')||'not selected'),
    '','## Restricted key permissions (owner review required)',
    '- Read: '+(p.key_permissions.read.join(', ')||'none declared'),
    '- Write: '+(p.key_permissions.write.join(', ')||'none declared'),
    '','## Portal policy',
    ...Object.entries(p.portal_rules).map(([k,v])=>'- '+k+': '+v),
    '','## Missing verification / decisions',
    ...(draft.missing.length?draft.missing.map(x=>'- '+x):['- Owner acceptance remains required']),
    '','Commit this text only in the project repository after owner review. Do not paste secrets.'
  ];
  return lines.join('\n');
}
export function normalizedSetup(project){
  if(!obj(project)||Object.keys(project).some(k=>![
    'id','name','website','webhookUrl','webhookEvents','metadataKeys','stripeCalls',
    'checkoutModes','paymentMethods','ownsCatalog','ownsTaxRates','keyPermissions',
    'portalRules','recordLinks','billing','portalConfiguration',
    'paymentMethodConfiguration','brandKit','applyBrandKit'].includes(k)))
    fail('Unknown project setup requirement');
  const draft=draftFromFindings(Object.fromEntries(Object.entries(project).filter(
    ([k])=>!['billing','portalConfiguration','paymentMethodConfiguration',
      'brandKit','applyBrandKit'].includes(k))));
  if(draft.unrecognizedEvents.length||draft.profile.webhook_events.length&&
    !project.webhookUrl)fail('Resolve unknown webhook events and endpoint URL before mutation');
  const hasCatalog=!project.ownsCatalog;
  if(!obj(project.billing)||!['monthly','one_time'].includes(project.billing.kind)||
    Object.keys(project.billing).some(k=>!['kind','productName','amountCents','lookupKey'].includes(k)))
    fail('Select explicit monthly or one-time billing requirements');
  const b=project.billing;
  if(hasCatalog&&(!text(b.productName,120)||!Number.isSafeInteger(b.amountCents)||
    b.amountCents<1||b.amountCents>100000000||
    typeof b.lookupKey!=='string'||!/^[a-z0-9][a-z0-9_-]{2,99}$/.test(b.lookupKey)))
    fail('Project-owned catalog requires explicit product, integer cents and stable lookup key');
  if(project.portalConfiguration!==undefined&&!/^bpc_[A-Za-z0-9_]{3,190}$/.test(project.portalConfiguration))
    fail('Select exact existing TEST Portal configuration');
  if(project.paymentMethodConfiguration!==undefined&&
    !/^pmc_[A-Za-z0-9]{2,100}$/.test(project.paymentMethodConfiguration))
    fail('Select exact direct TEST payment method configuration');
  if(project.brandKit!==undefined&&
    (project.applyBrandKit!==true||!obj(project.brandKit)))
    fail('Saving global MCP Checkout brand kit requires explicit owner opt-in');
  if(project.applyBrandKit===true&&!project.brandKit)
    fail('An explicit public kit is required before account-global override');
  const steps=[
    ...(draft.profile.webhook_events.length?['webhook']:[]),
    'portal',
    ...(project.paymentMethods.includes('us_bank_account')?['methods']:[]),
    ...(project.brandKit?['brand']:[]),
    ...(hasCatalog?['product','price']:[]),
    'draft'
  ];
  const digest=createHash('sha256').update(JSON.stringify(project)).digest('hex');
  return {project,steps,digest,draft,appNeeds:appNeeds(draft),
    profile:draft.profile,needsReview:draft.missing,billing:b};
}
