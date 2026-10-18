// E-2: provider-backed discounts, entitlements, and manual tax rates.
// Every mutation uses the original audited write contract and selected provider mode.
import {defineWrite,gone} from './write.js';
import {allProfiles,writeProfiles,fullProfiles,paging,pageResult,reply,fail,validateMetadata,checkId} from './billing-shared.js';
import {catalogClient,catalogMode} from './catalog-mode.js';
import {findAppOwnership,APP_METADATA_KEYS} from './app-guard.js';

const text=(max=160)=>({type:'string',minLength:1,maxLength:max});
const bool={type:'boolean'};
const number={type:'number',minimum:0,maximum:100};
const integer={type:'integer',minimum:1,maximum:100000000};
const date={type:'integer',minimum:946684800,maximum:4102444800};
const metadata={type:'object',additionalProperties:{type:'string'}};
const sid=prefix=>({type:'string',pattern:'^'+prefix+'_[A-Za-z0-9_]{2,100}$'});
const couponId=text(100),promoId=sid('promo'),featureId=sid('feat');
const productId=sid('prod'),customerId=sid('cus'),taxrateId=sid('txr');
const page={limit:{type:'integer',minimum:1,maximum:100},starting_after:text(110)};
const flags={dryRun:bool,confirm:bool,requestKey:text(128)};
const schema=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const error=msg=>{throw new TypeError(msg);};
const keys=new Set(APP_METADATA_KEYS);
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const code=v=>typeof v==='string'&&/^[A-Za-z0-9]{3,100}$/.test(v);
const coupon=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{2,100}$/.test(v);
const lookup=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{2,99}$/.test(v);
const mode=ctx=>ctx.connection.mode==='live';
function safe(value,kind,ctx) {
  if(!obj(value)||value.object!==kind||value.livemode!==mode(ctx))
    error('Stripe did not confirm a complete selected-mode '+kind);
  if(typeof value.id!=='string'||!value.id||value.id.length>110)
    error('Provider returned an invalid '+kind+' identity');
  const v=value;
  switch(kind){
    case 'coupon':
      if(!coupon(v.id)||!['once','forever','repeating'].includes(v.duration)||
        v.percent_off===null&&v.amount_off===null||
        v.percent_off!==null&&v.amount_off!==null)error('Coupon terms unavailable');
      return {id:v.id,name:v.name??null,percentOff:v.percent_off??null,
        amountOff:v.amount_off??null,currency:v.currency??null,duration:v.duration,
        valid:v.valid===true,redeemBy:v.redeem_by??null,metadata:v.metadata??{}};
    case 'promotion_code':{
      const couponRef=typeof v.coupon==='string'?v.coupon:v.coupon?.id;
      if(!coupon(couponRef)||!code(v.code))error('Promotion code facts unavailable');
      if(obj(v.coupon))safe(v.coupon,'coupon',ctx);
      return {id:v.id,code:v.code,coupon:couponRef,active:v.active===true,
        customer:typeof v.customer==='string'?v.customer:v.customer?.id??null,
        maxRedemptions:v.max_redemptions??null,expiresAt:v.expires_at??null,
        metadata:v.metadata??{}};
    }
    case 'entitlements.feature':
      if(!lookup(v.lookup_key))error('Entitlement lookup key missing');
      return {id:v.id,lookupKey:v.lookup_key,name:v.name??null,active:v.active===true};
    case 'entitlements.active_entitlement':
      if(!lookup(v.lookup_key)||typeof v.feature!=='string')
        error('Active entitlement facts unavailable');
      return {id:v.id,feature:v.feature,lookupKey:v.lookup_key};
    case 'tax_rate':
      if(!Number.isFinite(v.percentage)||typeof v.inclusive!=='boolean')
        error('Provider tax rate facts unavailable');
      return {id:v.id,displayName:v.display_name,percentage:v.percentage,
        inclusive:v.inclusive,active:v.active===true,description:v.description??null,
        jurisdiction:v.jurisdiction??null,country:v.country??null,
        state:v.state??null,metadata:v.metadata??{}};
    default:error('Unknown Stripe projection');
  }
}
function linkSafe(v,ctx){
  if(!obj(v)||v.object!=='product_feature'||typeof v.id!=='string'||
    (v.livemode!==undefined&&v.livemode!==mode(ctx)))
    error('Product feature could not be verified');
  const feature=typeof v.entitlement_feature==='string'?v.entitlement_feature:
    v.entitlement_feature?.id;
  checkId(feature,'feat');
  return {id:v.id,feature};
}
function argsOk(a,fields,required=[]){
  if(!obj(a)||Object.keys(a).some(k=>!fields.includes(k))||
    required.some(k=>a[k]===undefined))error('Missing or unsupported E-2 fields');
  for(const [k,v] of Object.entries(a)){
    if(['dryRun','confirm','active','inclusive'].includes(k)&&typeof v!=='boolean')
      error('Invalid '+k);
    if(['couponId','coupon'].includes(k)&&!coupon(v))error('Invalid coupon identifier');
    if(['promoId','featureId','productId','customerId','taxrateId'].includes(k))
      checkId(v,{promoId:'promo',featureId:'feat',productId:'prod',
        customerId:'cus',taxrateId:'txr'}[k]);
    if(['name','displayName','description','jurisdiction'].includes(k)&&
      (typeof v!=='string'||v.length>200||v.length<1||/[\x00-\x1f]/.test(v)))
      error('Invalid '+k);
    if(k==='code'&&!code(v))error('Promotion code must be alphanumeric');
    if(k==='lookupKey'&&!lookup(v))error('Invalid entitlement lookup key');
    if(k==='currency'&&!/^[a-z]{3}$/.test(v))error('Invalid currency');
    if(k==='duration'&&!['once','forever','repeating'].includes(v))
      error('Invalid discount duration');
    if(['amountOff','maxRedemptions','durationInMonths'].includes(k)&&
      (!Number.isSafeInteger(v)||v<1||v>100000000))error('Invalid '+k);
    if(['percentOff','percentage'].includes(k)&&
      (typeof v!=='number'||!Number.isFinite(v)||v<=0||v>100))error('Invalid '+k);
    if(['redeemBy','expiresAt'].includes(k)&&
      (!Number.isSafeInteger(v)||v<946684800||v>4102444800))
      error('Invalid '+k);
    if(k==='requestKey'&&(typeof v!=='string'||v.length<1||v.length>128))
      error('Stable requestKey required');
    if(k==='metadata'){
      validateMetadata(v);
      if(Object.keys(v).some(key=>keys.has(key)))error('App ownership markers are reserved');
    }
  }
}
const specsRead=[
  ['coupon_list',{...page}],['coupon_get',{couponId},['couponId']],
  ['promo_list',{...page,code:text(100),couponId},[]],
  ['promo_get',{promoId},['promoId']],
  ['promo_find_by_code',{code:text(100)},['code']],
  ['feature_list',{...page}],
  ['feature_list_for_product',{productId,...page},['productId']],
  ['entitlement_list_active',{customerId,...page},['customerId']],
  ['taxrate_list',{...page,active:bool}],['taxrate_get',{taxrateId},['taxrateId']]
];
export const tools=specsRead.map(([name,props,required=[]])=>({
  name,area:'catalog',profiles:allProfiles,writes:false,
  annotations:{readOnlyHint:true},description:'Read verified selected-mode Stripe '+name.replaceAll('_',' ')+' with bounded output.',
  inputSchema:schema(props,required)
}));
async function product(s,id,ctx){
  const p=await s.products.retrieve(id);
  if(p?.object!=='product'||p.livemode!==mode(ctx)||p.id!==id)
    error('Selected-mode product unavailable');
  return p;
}
async function ownerScope(ctx){
  if(typeof ctx.db?.listKnownAppsForAccount!=='function'||
    typeof ctx.db?.getAppGuardScope!=='function')
    error('Application ownership scope unavailable');
  const account=ctx.connection.stripeAccount;
  const [apps,scope]=await Promise.all([
    ctx.db.listKnownAppsForAccount(account),ctx.db.getAppGuardScope(account)]);
  if(!Array.isArray(apps)||!['legacy','scoped'].includes(scope))
    error('Application ownership registry unavailable');
  const reserved=new Set(keys);
  for(const app of apps)for(const key of app.profile?.metadata_keys??[])reserved.add(key);
  return {apps,reserved};
}
async function notOwned(resource,ctx){
  const status=await findAppOwnership(resource,ctx);
  if(status)error('Application-owned or uncertain Stripe resource cannot be changed');
}
async function cleanMetadata(a,ctx){
  if(a.metadata===undefined)return;
  const scope=await ownerScope(ctx);
  if(Object.keys(a.metadata).some(k=>scope.reserved.has(k)))
    error('Cannot write application-owned metadata');
}
const simplePage=(p,kind,ctx)=>pageResult(p,v=>safe(v,kind,ctx));
const reads={
  coupon_list:async(a,s,ctx)=>simplePage(await s.coupons.list(paging(a)),'coupon',ctx),
  coupon_get:async(a,s,ctx)=>safe(await s.coupons.retrieve(a.couponId),'coupon',ctx),
  promo_list:async(a,s,ctx)=>simplePage(await s.promotionCodes.list({
    ...paging(a),...(a.code?{code:a.code}:{}),
    ...(a.couponId?{coupon:a.couponId}:{})}),'promotion_code',ctx),
  promo_get:async(a,s,ctx)=>safe(await s.promotionCodes.retrieve(a.promoId),'promotion_code',ctx),
  promo_find_by_code:async(a,s,ctx)=>{
    const p=await s.promotionCodes.list({code:a.code,limit:100});
    const matches=simplePage(p,'promotion_code',ctx);
    if(matches.has_more)error('Promotion code query ambiguous across pages');
    return {data:matches.data.filter(x=>x.code.toLowerCase()===a.code.toLowerCase())};
  },
  feature_list:async(a,s,ctx)=>simplePage(await s.entitlements.features.list(paging(a)),
    'entitlements.feature',ctx),
  feature_list_for_product:async(a,s,ctx)=>{
    await product(s,a.productId,ctx);
    return pageResult(await s.products.listFeatures(a.productId,paging(a)),
      x=>linkSafe(x,ctx));
  },
  entitlement_list_active:async(a,s,ctx)=>simplePage(
    await s.entitlements.activeEntitlements.list({customer:a.customerId,...paging(a)}),
    'entitlements.active_entitlement',ctx),
  taxrate_list:async(a,s,ctx)=>simplePage(await s.taxRates.list({
    ...paging(a),...(a.active===undefined?{}:{active:a.active})}),'tax_rate',ctx),
  taxrate_get:async(a,s,ctx)=>safe(await s.taxRates.retrieve(a.taxrateId),'tax_rate',ctx)
};
export const handlers=Object.fromEntries(specsRead.map(([name,props,required=[]])=>[
  name,async(a,ctx)=>{
    try {
      argsOk(a,Object.keys(props),required);
      if(name==='promo_find_by_code'||a.code!==undefined)
        if(!code(a.code))error('Invalid promotion code');
      const stripe=await catalogClient(ctx);
      return reply(await reads[name](a,stripe,ctx));
    } catch(e) { if(e instanceof TypeError)return fail(e.message); throw e; }
  }
]));
const specsWrite=[
  {name:'coupon_create',required:['duration'],props:{couponId,percentOff:number,
    amountOff:integer,currency:text(3),duration:{type:'string',enum:['once','forever','repeating']},
    name:text(200),redeemBy:date,durationInMonths:{type:'integer',minimum:1,maximum:36},metadata}},
  {name:'coupon_update',required:['couponId'],props:{couponId,name:text(200),metadata}},
  {name:'coupon_delete',required:['couponId'],props:{couponId},destructive:true},
  {name:'promo_create',required:['couponId','code'],props:{
    couponId,code:text(100),customerId,maxRedemptions:integer,expiresAt:date,metadata}},
  {name:'promo_update',required:['promoId'],props:{promoId,active:bool,metadata}},
  {name:'feature_create',required:['name','lookupKey'],props:{name:text(200),lookupKey:text(100)},full:true},
  {name:'feature_attach_to_product',required:['productId','featureId'],
    props:{productId,featureId},full:true},
  {name:'feature_detach_from_product',required:['productId','featureId'],
    props:{productId,featureId},full:true,destructive:true},
  {name:'taxrate_create',required:['displayName','percentage','inclusive'],
    props:{displayName:text(200),percentage:number,inclusive:bool,description:text(200),
      jurisdiction:text(100),metadata},},
  {name:'taxrate_update',required:['taxrateId'],props:{
    taxrateId,active:bool,displayName:text(200),description:text(200),
    jurisdiction:text(100),metadata}}
];
const pick=(a,map)=>Object.fromEntries(Object.entries(map)
  .filter(([key])=>a[key]!==undefined).map(([key,api])=>[api,a[key]]));
function validateBusiness(n,a){
  if(n==='coupon_create'){
    if((a.percentOff===undefined)===(a.amountOff===undefined))
      error('Choose exactly one percentOff or amountOff coupon form');
    if((a.amountOff!==undefined)!==(a.currency!==undefined))
      error('Fixed amount coupons require the matching currency');
    if(a.duration==='repeating'&&a.durationInMonths===undefined)
      error('Repeating duration requires explicit durationInMonths');
    if(a.duration!=='repeating'&&a.durationInMonths!==undefined)
      error('Only repeating coupons accept durationInMonths');
  }
  if(n==='promo_create'&&a.code!==undefined&&!code(a.code))
    error('Invalid promotion code');
  if(['coupon_update','promo_update','taxrate_update'].includes(n)&&
    Object.keys(a).every(k=>['couponId','promoId','taxrateId','dryRun','confirm','requestKey'].includes(k)))
    error('Specify a mutable provider field');
}
function makeWrite(spec){
  const n=spec.name;
  let created=null,deleted=false,duplicate=null,linkBefore=null;
  const operation=defineWrite({
    name:n,
    resultId:(_before,after)=>after?.deleted?null:after?.id??null,
    read:async(a,ctx)=>{
      created=null;deleted=false;duplicate=null;linkBefore=null;
      argsOk(a,[...Object.keys(spec.props),...Object.keys(flags)],spec.required);
      validateBusiness(n,a);
      await cleanMetadata(a,ctx);
      // For writes with no metadata, still verify the account's ownership registry.
      await ownerScope(ctx);
      const s=await catalogClient(ctx);
      if(n==='coupon_create'){
        if(a.couponId){
          try{
            const existing=await s.coupons.retrieve(a.couponId);
            safe(existing,'coupon',ctx);await notOwned(existing,ctx);
            const match=existing.duration===a.duration&&
              existing.percent_off===(a.percentOff??null)&&
              existing.amount_off===(a.amountOff??null)&&
              existing.currency===(a.currency??null)&&
              (existing.duration_in_months??null)===(a.durationInMonths??null);
            if(!match)error('Coupon ID already exists with different immutable discount terms');
            duplicate=existing.id;return existing;
          }catch(e){if(e?.statusCode!==404||e?.code!=='resource_missing')throw e;}
        }
        return {object:'coupon',id:null,metadata:{}};
      }
      if(n==='promo_create'){
        const c=await s.coupons.retrieve(a.couponId);
        if(!safe(c,'coupon',ctx).valid)error('Cannot create promotion for invalid coupon');
        await notOwned(c,ctx);
        const matches=await s.promotionCodes.list({code:a.code,limit:100});
        const p=simplePage(matches,'promotion_code',ctx);
        if(p.has_more||p.data.some(x=>x.code.toLowerCase()===a.code.toLowerCase()&&
          x.active&&(x.coupon!==a.couponId||
            x.customer!==(a.customerId??null)||
            x.maxRedemptions!==(a.maxRedemptions??null)||
            x.expiresAt!==(a.expiresAt??null))))
          error('Active promotion code already exists with different immutable restrictions');
        const existing=p.data.find(x=>x.code.toLowerCase()===a.code.toLowerCase()&&x.active);
        if(existing)duplicate=existing.id;
        return {object:'promotion_code',id:null,metadata:{},coupon:c.id};
      }
      if(n==='feature_create'){
        const list=await s.entitlements.features.list({limit:100});
        const p=simplePage(list,'entitlements.feature',ctx);
        if(p.has_more)error('Feature lookup must be unambiguous');
        const prior=p.data.find(x=>x.lookupKey===a.lookupKey);
        if(prior){
          if(prior.name!==a.name)error('Feature lookup key conflicts with existing feature');
          duplicate=prior.id;
        }
        return {object:'entitlements.feature',id:null,metadata:{}};
      }
      if(n==='taxrate_create')return {object:'tax_rate',id:null,metadata:{}};
      if(n==='feature_attach_to_product'||n==='feature_detach_from_product'){
        const p=await product(s,a.productId,ctx);await notOwned(p,ctx);
        const f=await s.entitlements.features.retrieve(a.featureId);
        safe(f,'entitlements.feature',ctx);
        const listed=await s.products.listFeatures(a.productId,{limit:100});
        const links=pageResult(listed,x=>linkSafe(x,ctx));
        if(links.has_more)error('Product feature list incomplete');
        linkBefore=links.data.find(x=>x.feature===a.featureId)??null;
        if(n==='feature_attach_to_product'&&linkBefore)duplicate=linkBefore.id;
        if(n==='feature_detach_from_product'&&!linkBefore)
          error('Product feature attachment missing');
        return {...p,id:p.id};
      }
      const family=n.startsWith('coupon')?'coupons':
        n.startsWith('promo')?'promotionCodes':'taxRates';
      const id=a.couponId??a.promoId??a.taxrateId;
      const before=await s[family].retrieve(id);
      safe(before,n.startsWith('coupon')?'coupon':
        n.startsWith('promo')?'promotion_code':'tax_rate',ctx);
      await notOwned(before,ctx);
      return before;
    },
    summarize:(before,a,ctx)=>ctx.connection.mode.toUpperCase()+' MODE: '+n+
      '. May change customer discounts, access entitlements, tax collection or future invoice totals.'+
      ' Confirm exact target and terms; original audit, idempotency and independent provider readback required.'+
      (duplicate?' Existing exact match will be reused without an additional provider creation.':'')+
      (spec.destructive?' DESTRUCTIVE: affects future use; existing billing records may remain.':''),
    targetGuard:async()=>true,
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await catalogClient(ctx),o={idempotencyKey};
      if(duplicate)return;
      let v;
      if(n==='coupon_create')v=await s.coupons.create({
        ...pick(a,{couponId:'id',percentOff:'percent_off',amountOff:'amount_off',
          currency:'currency',duration:'duration',name:'name',
          redeemBy:'redeem_by',durationInMonths:'duration_in_months',metadata:'metadata'})},o);
      if(n==='coupon_update')v=await s.coupons.update(a.couponId,
        pick(a,{name:'name',metadata:'metadata'}),o);
      if(n==='coupon_delete'){
        v=await s.coupons.del(a.couponId,undefined,o);
        deleted=v?.deleted===true&&v?.id===a.couponId;
      }
      if(n==='promo_create')v=await s.promotionCodes.create(pick(a,{
        couponId:'coupon',code:'code',customerId:'customer',
        maxRedemptions:'max_redemptions',expiresAt:'expires_at',metadata:'metadata'}),o);
      if(n==='promo_update')v=await s.promotionCodes.update(a.promoId,
        pick(a,{active:'active',metadata:'metadata'}),o);
      if(n==='feature_create')v=await s.entitlements.features.create(
        pick(a,{name:'name',lookupKey:'lookup_key'}),o);
      if(n==='feature_attach_to_product')v=await s.products.createFeature(
        a.productId,{entitlement_feature:a.featureId},o);
      if(n==='feature_detach_from_product'){
        v=await s.products.deleteFeature(a.productId,linkBefore.id,o);
        deleted=v?.deleted===true&&v?.id===linkBefore.id;
      }
      if(n==='taxrate_create')v=await s.taxRates.create(pick(a,{
        displayName:'display_name',percentage:'percentage',inclusive:'inclusive',
        description:'description',jurisdiction:'jurisdiction',metadata:'metadata'}),o);
      if(n==='taxrate_update')v=await s.taxRates.update(a.taxrateId,
        pick(a,{active:'active',displayName:'display_name',
          description:'description',jurisdiction:'jurisdiction',metadata:'metadata'}),o);
      created=v?.id??null;
    },
    readAfter:async(a,ctx)=>{
      const s=await catalogClient(ctx);
      if(n==='coupon_delete'){
        if(!deleted)error('Provider coupon deletion receipt missing');
        try{return await s.coupons.retrieve(a.couponId);}
        catch(e){if(e?.statusCode===404&&e?.code==='resource_missing')
          return {id:a.couponId,deleted:true};throw e;}
      }
      if(n==='feature_attach_to_product'||n==='feature_detach_from_product'){
        await product(s,a.productId,ctx);
        const p=await s.products.listFeatures(a.productId,{limit:100});
        const list=pageResult(p,x=>linkSafe(x,ctx));
        if(list.has_more)error('Feature readback incomplete');
        const found=list.data.find(x=>x.feature===a.featureId);
        if(n==='feature_detach_from_product')return deleted&&!found?
          {id:linkBefore.id,deleted:true}:found;
        return found??null;
      }
      if(n==='coupon_create'||n==='coupon_update')return s.coupons.retrieve(
        n==='coupon_create'?duplicate??created:a.couponId);
      if(n==='promo_create'||n==='promo_update')return s.promotionCodes.retrieve(
        n==='promo_create'?duplicate??created:a.promoId);
      if(n==='feature_create')return s.entitlements.features.retrieve(duplicate??created);
      return s.taxRates.retrieve(n==='taxrate_create'?created:a.taxrateId);
    },
    verify:async(before,after,a,ctx)=>{
      if(n==='coupon_delete')return deleted&&after?.deleted===true&&after?.id===a.couponId;
      if(n==='feature_detach_from_product')return deleted&&after?.deleted===true&&
        after.id===linkBefore?.id;
      if(n==='feature_attach_to_product')return after?.id===(duplicate??created)&&
        after.feature===a.featureId;
      const kind=n.startsWith('coupon')?'coupon':n.startsWith('promo')?
        'promotion_code':n.startsWith('feature')?'entitlements.feature':'tax_rate';
      const v=safe(after,kind,ctx);
      if(n.endsWith('_create')||n==='feature_create')
        if(v.id!==(duplicate??created))return false;
      const expectations={
        coupon_create:{percentOff:a.percentOff??null,amountOff:a.amountOff??null,
          currency:a.currency??null,duration:a.duration},
        coupon_update:{name:a.name},
        promo_create:{code:a.code,coupon:a.couponId,
          customer:a.customerId,maxRedemptions:a.maxRedemptions,
          expiresAt:a.expiresAt},
        promo_update:{active:a.active},
        feature_create:{name:a.name,lookupKey:a.lookupKey},
        taxrate_create:{displayName:a.displayName,percentage:a.percentage,
          inclusive:a.inclusive,description:a.description},
        taxrate_update:{active:a.active,displayName:a.displayName,
          description:a.description,jurisdiction:a.jurisdiction}
      }[n]??{};
      for(const [k,value] of Object.entries(expectations))
        if(value!==undefined&&v[k]!==value)return false;
      if(a.metadata!==undefined)
        for(const [k,value] of Object.entries(a.metadata))
          if(v.metadata?.[k]!==value)return false;
      if(n==='taxrate_update'&&(v.percentage!==before.percentage||
        v.inclusive!==before.inclusive))return false;
      if(n==='coupon_update'&&(v.percentOff!==before.percent_off||
        v.amountOff!==before.amount_off||v.duration!==before.duration))return false;
      return true;
    }
  });
  return (args,ctx)=>catalogMode(ctx)?operation.handler(args,ctx):
    gone('Selected TEST/LIVE Stripe account required');
}
for(const s of specsWrite){
  const write=defineWrite({name:s.name,read:async()=>({}),summarize:()=>s.name,
    apply:async()=>{},readAfter:async()=>({}),verify:async()=>false});
  tools.push({...write.tool,area:'catalog',profiles:s.full?fullProfiles:writeProfiles,
    description:'Guarded selected-mode '+s.name.replaceAll('_',' ')+
      '; audited confirmation and provider readback.',
    ...(s.destructive?{annotations:{destructiveHint:true}}:{}),
    inputSchema:schema({...s.props,...flags},s.required)});
  handlers[s.name]=(a,ctx)=>makeWrite(s)(a,ctx);
}
