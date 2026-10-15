// E-1: native TEST catalog. Prices are immutable financial terms, not editable amounts.
// All writes use the original guarded/audited Stripe write lifecycle.
import {defineWrite,gone} from './write.js';
import {client,guarded,allProfiles,writeProfiles,fullProfiles,
  paging,pageResult} from './billing-shared.js';
import {APP_METADATA_KEYS,findAppOwnership,annotateAppRead} from './app-guard.js';

const string=(max=160)=>({type:'string',minLength:1,maxLength:max});
const productId={type:'string',pattern:'^prod_[A-Za-z0-9]{2,100}$'};
const priceId={type:'string',pattern:'^price_[A-Za-z0-9]{2,100}$'};
const yes={type:'boolean'};
const cents={type:'integer',minimum:0,maximum:100000000};
const metadata={type:'object',additionalProperties:{type:'string'}};
const listArgs={limit:{type:'integer',minimum:1,maximum:100},
  starting_after:string(110)};
const flags={dryRun:yes,confirm:yes,requestKey:string(128)};
const schema=(properties,required=[])=>({type:'object',properties,
  required,additionalProperties:false});
const err=m=>{throw new TypeError(m);};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const matches=(v,p)=>typeof v==='string'&&new RegExp('^'+p+'_[A-Za-z0-9]{2,100}$').test(v);
const safeText=(v,max)=>typeof v==='string'&&v.trim().length>0&&
  v.length<=max&&!/[\x00-\x1f]/.test(v);
const safeLookup=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{2,99}$/.test(v);
const ownedKeys=new Set(APP_METADATA_KEYS);
function checkMetadata(value,ctx){
  if(value===undefined)return;
  if(!plain(value)||Object.keys(value).length>20||
    Object.entries(value).some(([k,v])=>
      !/^[A-Za-z0-9_-]{1,40}$/.test(k)||ownedKeys.has(k)||
      ['__proto__','constructor','prototype'].includes(k)||
      typeof v!=='string'||v.length>200))
    err('Invalid or application-owned catalog metadata');
  if(ctx?._catalogProfileKeys&&Object.keys(value).some(k=>
    ctx._catalogProfileKeys.includes(k)))err('A bound application owns this metadata marker');
}
const productSafe=v=>{
  if(!matches(v?.id,'prod')||v.object!=='product'||v.livemode!==false)
    err('Complete TEST product was not confirmed by Stripe');
  return {id:v.id,name:v.name??null,active:v.active===true,
    description:v.description??null,defaultPrice:typeof v.default_price==='string'?
      v.default_price:v.default_price?.id??null,
    metadata:v.metadata??{},created:v.created??null};
};
const priceSafe=v=>{
  if(!matches(v?.id,'price')||v.object!=='price'||v.livemode!==false)
    err('Complete TEST price was not confirmed by Stripe');
  const product=typeof v.product==='string'?v.product:v.product?.id;
  if(!matches(product,'prod'))err('Price has no verifiable product');
  return {id:v.id,product,active:v.active===true,
    currency:v.currency,unitAmountCents:v.unit_amount,lookupKey:v.lookup_key??null,
    nickname:v.nickname??null,type:v.type,
    recurring:v.recurring?{interval:v.recurring.interval,
      intervalCount:v.recurring.interval_count,usageType:v.recurring.usage_type}:null,
    metadata:v.metadata??{}};
};
function checkArgs(a,allowed,required=[]){
  if(!plain(a)||Object.keys(a).some(k=>!allowed.includes(k))||
    required.some(k=>a[k]===undefined))err('Unsupported or missing catalog fields');
  for(const [k,v] of Object.entries(a)){
    if(k==='productId'&&!matches(v,'prod')||k==='priceId'&&!matches(v,'price'))
      err('Invalid catalog ID');
    if(['name','description','nickname'].includes(k)&&!safeText(v,k==='name'?120:350))
      err('Invalid catalog text');
    if(k==='lookupKey'&&!safeLookup(v))err('Use stable lowercase catalog lookup key');
    if(k==='unitAmountCents'&&(!Number.isSafeInteger(v)||v<0||v>100000000))
      err('Price must use bounded integer minor units');
    if(k==='currency'&&v!=='usd')err('Only explicit USD catalog writes are supported');
    if(k==='interval'&&!['month','year'].includes(v))err('Unsupported recurring interval');
    if(k==='intervalCount'&&(!Number.isSafeInteger(v)||v<1||v>12))
      err('Unsupported recurring interval count');
    if(['active','outsideApp','dryRun','confirm'].includes(k)&&typeof v!=='boolean')
      err('Invalid catalog flag');
    if(k==='requestKey'&&!safeText(v,128))err('Stable requestKey required');
  }
  if(a.metadata!==undefined)checkMetadata(a.metadata);
}
function searchQuery(a){
  checkArgs(a,['query','limit','page'],['query']);
  if(!safeText(a.query,220)||!/^[a-zA-Z0-9_@\-\s.\[\]:'"~+*]+$/.test(a.query))
    err('Use a bounded Stripe search expression');
  if(a.limit!==undefined&&(!Number.isInteger(a.limit)||a.limit<1||a.limit>100))
    err('Invalid search page size');
  if(a.page!==undefined&&!/^[A-Za-z0-9_=-]{3,110}$/.test(a.page))
    err('Invalid Stripe search cursor');
  return {query:a.query,limit:a.limit??20,...(a.page?{page:a.page}:{})};
}
const read=(name,description,props,required=[])=>({
  name,description,area:'catalog',profiles:allProfiles,writes:false,
  annotations:{readOnlyHint:true},inputSchema:schema(props,required)});
export const tools=[
  read('product_list','List TEST products with bounded paging.',{...listArgs,active:yes}),
  read('product_get','Read exact TEST product and app-owned metadata.',{productId},['productId']),
  read('product_search','Search TEST products with a bounded provider query.',
    {query:string(220),limit:listArgs.limit,page:string(110)},['query']),
  read('price_list','List TEST prices for a product or exact lookup key.',
    {...listArgs,productId,lookupKey:string(100),active:yes}),
  read('price_get','Read exact TEST price terms (immutable amount and cadence).',
    {priceId},['priceId']),
  read('price_search','Search TEST prices with bounded provider query.',
    {query:string(220),limit:listArgs.limit,page:string(110)},['query'])
];
const readOnly={
  product_list:async(a,ctx)=>guarded(ctx,async s=>{
    checkArgs(a,['limit','starting_after','active']);
    if(a.active!==undefined&&typeof a.active!=='boolean')err('Invalid active filter');
    return pageResult(await s.products.list({...paging(a),
      ...(a.active===undefined?{}:{active:a.active})}),productSafe);
  }),
  product_get:async(a,ctx)=>guarded(ctx,async s=>{
    checkArgs(a,['productId'],['productId']);
    return annotateAppRead(productSafe(await s.products.retrieve(a.productId)),ctx);
  }),
  product_search:async(a,ctx)=>guarded(ctx,async s=>{
    const p=await s.products.search(searchQuery(a));
    const page=pageResult(p,productSafe);
    return {...page,next:p.has_more?p.next_page??null:null};
  }),
  price_list:async(a,ctx)=>guarded(ctx,async s=>{
    checkArgs(a,['limit','starting_after','productId','lookupKey','active']);
    if(a.lookupKey!==undefined&&!safeLookup(a.lookupKey))err('Invalid lookup key');
    if(a.active!==undefined&&typeof a.active!=='boolean')err('Invalid active filter');
    return pageResult(await s.prices.list({...paging(a),
      ...(a.productId?{product:a.productId}:{}),
      ...(a.lookupKey?{lookup_keys:[a.lookupKey]}:{}),
      ...(a.active===undefined?{}:{active:a.active})}),priceSafe);
  }),
  price_get:async(a,ctx)=>guarded(ctx,async s=>{
    checkArgs(a,['priceId'],['priceId']);
    return annotateAppRead(priceSafe(await s.prices.retrieve(a.priceId)),ctx);
  }),
  price_search:async(a,ctx)=>guarded(ctx,async s=>{
    const p=await s.prices.search(searchQuery(a));
    const page=pageResult(p,priceSafe);
    return {...page,next:p.has_more?p.next_page??null:null};
  })
};
const specs=[
  {name:'product_create',required:['name'],
    props:{name:string(120),description:string(350),metadata}},
  {name:'product_update',required:['productId'],
    props:{productId,name:string(120),description:string(350),metadata}},
  {name:'product_archive',required:['productId'],props:{productId}},
  {name:'product_unarchive',required:['productId'],props:{productId}},
  {name:'product_delete',required:['productId'],props:{productId},full:true,destructive:true},
  {name:'price_create',required:['productId','lookupKey','unitAmountCents','currency'],
    props:{productId,lookupKey:string(100),unitAmountCents:cents,
      currency:{type:'string',enum:['usd']},
      interval:{type:'string',enum:['month','year']},
      intervalCount:{type:'integer',minimum:1,maximum:12},nickname:string(350),metadata}},
  {name:'price_update',required:['priceId'],
    props:{priceId,nickname:string(350),lookupKey:string(100),metadata,active:yes}}
];
async function profileBoundary(ctx){
  if(ctx?.connection?.mode!=='test'||!matches(ctx.connection.stripeAccount,'acct'))
    err('Selected TEST account required for catalog');
  if(!ctx.db?.listKnownAppsForAccount||!ctx.db?.getAppGuardScope)
    err('Account-scoped application ownership cannot be verified');
  let apps,scope;
  try{
    apps=await ctx.db.listKnownAppsForAccount(ctx.connection.stripeAccount);
    scope=await ctx.db.getAppGuardScope(ctx.connection.stripeAccount);
  }catch{err('Application ownership registry unavailable; catalog write denied');}
  if(!Array.isArray(apps)||!['legacy','scoped'].includes(scope))
    err('Application ownership scope unavailable');
  const keys=new Set(APP_METADATA_KEYS);
  for(const app of apps){
    for(const k of app.profile?.metadata_keys??[])keys.add(k);
  }
  return {keys:[...keys],apps,warning:apps.some(x=>x.profile?.owns_catalog===true)};
}
function mutableMatch(before,after,a,kind){
  const value=kind==='price'?priceSafe(after):productSafe(after);
  if(kind==='price'){
    if(before?.id&&value.id!==before.id)return false;
    if(a.lookupKey!==undefined&&value.lookupKey!==a.lookupKey)return false;
    if(a.nickname!==undefined&&value.nickname!==a.nickname)return false;
    if(a.active!==undefined&&value.active!==a.active)return false;
    if(a.metadata!==undefined&&Object.entries(a.metadata).some(([k,v])=>
      value.metadata[k]!==v))return false;
  }else{
    if(before?.id&&value.id!==before.id)return false;
    if(a.name!==undefined&&value.name!==a.name)return false;
    if(a.description!==undefined&&value.description!==a.description)return false;
    if(a.metadata!==undefined&&Object.entries(a.metadata).some(([k,v])=>
      value.metadata[k]!==v))return false;
  }
  return true;
}
async function exactLookup(s,key){
  const page=await s.prices.list({lookup_keys:[key],limit:2});
  if(!Array.isArray(page?.data)||page.has_more===true||page.data.length>1)
    err('Could not resolve a unique complete price lookup key');
  return page.data[0]??null;
}
function priceMatches(p,a){
  if(!p)return false;
  const x=priceSafe(p);
  return x.product===a.productId&&x.active&&x.currency===a.currency&&
    x.unitAmountCents===a.unitAmountCents&&x.lookupKey===a.lookupKey&&
    x.type===(a.interval?'recurring':'one_time')&&
    (!a.interval||x.recurring?.interval===a.interval&&
      x.recurring?.intervalCount===(a.intervalCount??1)&&
      x.recurring?.usageType==='licensed');
}
function makeWrite(def){
  let createdId=null,existingId=null,scope=null;
  const n=def.name,price=n.startsWith('price_'),creation=n.endsWith('_create');
  const op=defineWrite({
    name:n,
    resultId:(_before,after)=>after?.deleted?null:after?.id,
    read:async(a,ctx)=>{
      createdId=null;existingId=null;
      checkArgs(a,[...Object.keys(def.props),'dryRun','confirm','requestKey'],def.required);
      if(!creation&&!['product_archive','product_unarchive','product_delete'].includes(n)&&
        Object.keys(a).every(k=>['productId','priceId','dryRun','confirm','requestKey',
          'outsideApp'].includes(k)))err('Specify an explicit mutable field');
      if(n==='price_create'&&!a.interval&&a.intervalCount!==undefined)
        err('Interval count needs a recurring interval');
      scope=await profileBoundary(ctx);
      if(a.metadata!==undefined&&Object.keys(a.metadata).some(k=>scope.keys.includes(k)))
        err('Application-owned marker is never writable from native catalog');
      const s=await client(ctx);
      if(n==='product_create')return {id:null,object:'product',metadata:{}};
      if(n==='price_create'){
        const product=await s.products.retrieve(a.productId);
        productSafe(product);
        const owner=await findAppOwnership(product,ctx);
        if(owner?.unknown||owner)err('Price creation for app-owned or uncertain product denied');
        const existing=await exactLookup(s,a.lookupKey);
        if(existing&&!priceMatches(existing,a))
          err('Lookup key exists with different immutable product, amount or cadence');
        if(existing)existingId=existing.id;
        return {...product,lookupPrice:existing};
      }
      const b=price?await s.prices.retrieve(a.priceId):
        await s.products.retrieve(a.productId);
      (price?priceSafe:productSafe)(b);
      const owner=await findAppOwnership(b,ctx);
      if(owner?.unknown||owner)err('Application-owned or uncertain catalog record cannot be mutated');
      if(price){
        const parent=await s.products.retrieve(typeof b.product==='string'?b.product:b.product?.id);
        productSafe(parent);
        const parentOwner=await findAppOwnership(parent,ctx);
        if(parentOwner)err('Price parent product is app-owned or ownership is uncertain');
      }
      if(n==='product_delete'){
        const prices=await s.prices.list({product:b.id,limit:1});
        if(!Array.isArray(prices?.data)||prices.has_more===true||prices.data.length)
          err('Only products with no prices may be deleted');
      }
      return b;
    },
    summarize:(b,a)=>'TEST MODE: '+n+' on '+(a.productId||a.priceId||'new product')+
      '. Exact preview/confirmation, stable retry key and provider readback required.'+
      (scope?.warning?' A bound app owns its own catalog; this independent record is not an app-owned record.':'')+
      (n==='product_delete'?' DESTRUCTIVE: no prices may exist.':'')+
      (n==='price_create'&&existingId?' Existing exact lookup key will be reused; no second price.':''),
    targetGuard:async(a,ctx,b)=>{
      // Never allow an outsideApp override for catalog products or prices.
      if(a.outsideApp===true)return 'App-owned catalog override not permitted';
      if(n==='price_create'){
        const marker=await findAppOwnership(b,ctx);
        return marker?'Price product ownership is not clear':true;
      }
      return true;
    },
    apply:async(a,ctx,{idempotencyKey})=>{
      const s=await client(ctx),opts={idempotencyKey};
      if(n==='product_create'){
        const product=await s.products.create({
          name:a.name,...(a.description?{description:a.description}:{}),
          ...(a.metadata?{metadata:a.metadata}:{})},opts);
        createdId=product?.id;
      }
      if(n==='product_update')await s.products.update(a.productId,
        Object.fromEntries(['name','description','metadata'].filter(k=>a[k]!==undefined)
          .map(k=>[k,a[k]])),opts);
      if(n==='product_archive'||n==='product_unarchive')
        await s.products.update(a.productId,{active:n==='product_unarchive'},opts);
      if(n==='product_delete')await s.products.del(a.productId,undefined,opts);
      if(n==='price_create'&&!existingId){
        const p=await s.prices.create({product:a.productId,lookup_key:a.lookupKey,
          currency:a.currency,unit_amount:a.unitAmountCents,
          ...(a.interval?{recurring:{interval:a.interval,
            interval_count:a.intervalCount??1,usage_type:'licensed'}}:{}),
          ...(a.nickname?{nickname:a.nickname}:{}),
          ...(a.metadata?{metadata:a.metadata}:{})},opts);
        createdId=p?.id;
      }
      if(n==='price_update')await s.prices.update(a.priceId,{
        ...(a.nickname!==undefined?{nickname:a.nickname}:{}),
        ...(a.lookupKey!==undefined?{lookup_key:a.lookupKey}:{}),
        ...(a.metadata!==undefined?{metadata:a.metadata}:{}),
        ...(a.active!==undefined?{active:a.active}:{})},opts);
    },
    readAfter:async(a,ctx)=>{
      const s=await client(ctx);
      if(n==='product_delete')return s.products.retrieve(a.productId);
      if(n==='product_create'||n==='product_update'||
        n==='product_archive'||n==='product_unarchive')
        return s.products.retrieve(n==='product_create'?createdId:a.productId);
      if(n==='price_create'){
        const result=await exactLookup(s,a.lookupKey);
        return result&&result.id===(existingId??createdId)?result:null;
      }
      return s.prices.retrieve(a.priceId);
    },
    verify:async(b,after,a)=>{
      if(n==='product_delete')return after?.id===a.productId&&after.deleted===true;
      if(n==='product_archive'||n==='product_unarchive')
        return productSafe(after).id===a.productId&&
          after.active===(n==='product_unarchive');
      if(n==='product_create')
        return after?.id===createdId&&mutableMatch(b,after,a,'product');
      if(n==='product_update')return mutableMatch(b,after,a,'product');
      if(n==='price_create')return after?.id===(existingId??createdId)&&
        priceMatches(after,a);
      if(n==='price_update')return mutableMatch(b,after,a,'price')&&
        after.unit_amount===b.unit_amount&&after.currency===b.currency&&
        JSON.stringify(after.recurring??null)===JSON.stringify(b.recurring??null)&&
        (typeof after.product==='string'?after.product:after.product?.id)===
        (typeof b.product==='string'?b.product:b.product?.id);
      return false;
    }
  });
  return {...op,handler:(a,ctx)=>ctx?.connection?.mode==='test'?
    op.handler(a,ctx):gone('Native catalog mutation is TEST-only')};
}
tools.push(...specs.map(def=>({...makeWrite(def).tool,area:'catalog',
  profiles:def.full?fullProfiles:writeProfiles,
  description:def.name==='price_update'?
    'Change only nickname, lookup key, metadata or active status; immutable amount/cadence are refused.':
    'Guarded TEST catalog write with app ownership, confirmation and provider readback.',
  ...(def.destructive?{annotations:{destructiveHint:true}}:{}),
  inputSchema:schema({...def.props,...flags},def.required)})));
export const handlers={...readOnly,...Object.fromEntries(specs.map(d=>[
  d.name,(args,ctx)=>makeWrite(d).handler(args,ctx)]))};
