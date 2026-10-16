// W-9 catalog setup in native guarded stages. No synthetic product preflight,
// unapproved app-owned mutation, duplicate lookup key or automatic uncertain retry.
import {createHash} from 'node:crypto';
import {reply,fail} from './billing-shared.js';
import {nativeRead,deadline,expired} from './workflow-read-common.js';
import {writable,nativeWrite,readyStep} from './workflow-customer-actions.js';

const shape={
  productId:{type:'string',pattern:'^prod_[A-Za-z0-9]{2,100}$'},
  name:{type:'string',minLength:3,maxLength:120},
  description:{type:'string',minLength:1,maxLength:350},
  lookupKey:{type:'string',pattern:'^[a-z0-9][a-z0-9_-]{2,99}$'},
  unitAmountCents:{type:'integer',minimum:0,maximum:100000000},
  currency:{type:'string',enum:['usd']},
  interval:{type:'string',enum:['month','year']},
  intervalCount:{type:'integer',minimum:1,maximum:12},
  nickname:{type:'string',minLength:1,maxLength:120},
  previewToken:{type:'string',pattern:'^[a-f0-9]{64}$'},
  confirm:{type:'boolean'},dryRun:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:100}
};
export const tools=[{
  name:'workflow_set_up_catalog',area:'workflows',writes:true,
  profiles:['everyday','full'],writeContract:'defineWrite-v1',safety:'P',moneySpec:null,
  description:'Create TEST product then verified unique lookup-price via native guarded staged confirmation.',
  inputSchema:{type:'object',properties:shape,
    required:['name','lookupKey','unitAmountCents','currency'],additionalProperties:false}
}];
const product=/^prod_[A-Za-z0-9]{2,100}$/,key=/^[a-z0-9][a-z0-9_-]{2,99}$/;
const name=/^[A-Za-z0-9][A-Za-z0-9 ._-]{2,119}$/;
function validate(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!Object.hasOwn(shape,k))||
    !name.test(a.name??'')||!key.test(a.lookupKey??'')||a.currency!=='usd'||
    !Number.isSafeInteger(a.unitAmountCents)||a.unitAmountCents<0||
    a.unitAmountCents>100000000||
    a.productId!==undefined&&!product.test(a.productId)||
    a.interval!==undefined&&!['month','year'].includes(a.interval)||
    a.intervalCount!==undefined&&(!Number.isSafeInteger(a.intervalCount)||
      a.intervalCount<1||a.intervalCount>12||!a.interval)||
    a.description!==undefined&&(typeof a.description!=='string'||!a.description.trim()||
      a.description.length>350)||
    a.nickname!==undefined&&(typeof a.nickname!=='string'||!a.nickname.trim()||
      a.nickname.length>120))
    throw new TypeError('Exact stable TEST catalog product/lookup key and USD price required');
  if(a.confirm===true&&(!a.previewToken||!a.requestKey||a.dryRun===true))
    throw new TypeError('Exact fresh original native product/price preview and stable requestKey required');
}
const token=(a,ctx,facts,child)=>createHash('sha256').update(JSON.stringify({
  account:ctx.connection.stripeAccount,kind:'catalog-setup',
  input:Object.fromEntries(Object.entries(a).filter(([k])=>![
    'requestKey','previewToken','confirm','dryRun'].includes(k))),facts,child
})).digest('hex');
function priceMatches(p,a,id){
  return p?.active===true&&p.product===id&&p.currency===a.currency&&
    p.unitAmountCents===a.unitAmountCents&&p.lookupKey===a.lookupKey&&
    p.type===(a.interval?'recurring':'one_time')&&
    (!a.interval||(p.recurring?.interval===a.interval&&
      p.recurring.intervalCount===(a.intervalCount??1)&&
      p.recurring.usageType==='licensed'));
}
async function exactName(a,ctx){
  // If the user does not select productId, avoid duplicate product creation
  // by exhausting bounded exact-name search. Incomplete provider search FAILS.
  let cursor=null,pages=0,all=[],complete=false;
  while(pages<4&&all.length<200){
    const result=await nativeRead('product_search',{
      query:"name:'"+a.name+"'",limit:50,...(cursor?{page:cursor}:{})
    },ctx);
    if(!Array.isArray(result.data)||result.data.length>50||
      typeof result.has_more!=='boolean')
      throw new TypeError('Product search provider page invalid');
    all.push(...result.data.filter(p=>p.name===a.name));
    pages++;
    if(!result.has_more){complete=true;break;}
    if(typeof result.next!=='string'||result.next===cursor||!result.next)
      throw new TypeError('Original catalog search cursor unavailable');
    cursor=result.next;
  }
  if(!complete)throw new TypeError('Exact product name search incomplete; supply productId');
  if(all.length>1)throw new TypeError('Multiple named products exist; select exact productId');
  return all[0]??null;
}
async function setup(a,ctx){
  writable(ctx);validate(a);const end=deadline();
  let candidate=a.productId?await nativeRead('product_get',{productId:a.productId},ctx):
    await exactName(a,ctx);
  if(candidate&&(candidate.active!==true||candidate.name!==a.name||
      !product.test(candidate.id)))throw new TypeError('Selected active original product does not match the named catalog');
  const existing=await nativeRead('price_list',{lookupKey:a.lookupKey,limit:2},ctx);
  if(!Array.isArray(existing.data)||existing.has_more!==false||existing.data.length>1)
    throw new TypeError('Exact stable price lookup is ambiguous or incomplete');
  const found=existing.data[0]??null;
  if(found&&(!candidate||!priceMatches(found,a,candidate.id)))
    throw new TypeError('Lookup key is already assigned to different immutable price terms');
  if(expired(end))throw new TypeError('Catalog source time budget exceeded');
  const args=candidate?{
    productId:candidate.id,lookupKey:a.lookupKey,
    unitAmountCents:a.unitAmountCents,currency:a.currency,
    ...(a.interval?{interval:a.interval,
      intervalCount:a.intervalCount??1}:{}),
    ...(a.nickname?{nickname:a.nickname}:{})
  }:{name:a.name,...(a.description?{description:a.description}:{})};
  const operation=candidate?'price_create':'product_create';
  if(found){
    return {kind:'catalog_setup',account:ctx.connection.stripeAccount,
      done:true,confirmed:true,reusedExisting:true,productId:candidate.id,
      priceId:found.id,lookupKey:a.lookupKey,stage:'complete',
      noProviderWrite:true,note:'Exact immutable provider lookup terms already match; repeated call does not mutate catalog.'};
  }
  const native=await readyStep(operation,args,ctx);
  const fingerprint=token(a,ctx,{
    product:candidate?{id:candidate.id,name:candidate.name,active:candidate.active,
      metadata:candidate.metadata,defaultPrice:candidate.defaultPrice}:null,
    lookup:{data:[],has_more:false}},native.preview);
  const result={kind:'catalog_setup',account:ctx.connection.stripeAccount,
    mode:'test',done:false,stage:candidate?'price':'product',
    productId:candidate?.id??null,lookupKey:a.lookupKey,
    needsConfirmation:true,previewToken:fingerprint,
    nativeTool:operation,nativePreview:native.preview,
    nextAction:candidate?'Confirm native guarded price creation':
      'Confirm product creation, then review and confirm the price in a second distinct native preview'};
  if(a.confirm!==true)return result;
  if(a.previewToken!==fingerprint)
    throw new TypeError('Original product/price changed; refresh catalog preview');
  try{
    const out=await nativeWrite(operation,{
      ...args,confirm:true,requestKey:a.requestKey+':'+operation},ctx);
    const good=!out.isError&&out.value.done===true&&out.value.confirmed===true&&
      (operation!=='product_create'||product.test(out.value.resourceId??''));
    if(!good)return {...result,confirmed:false,needsConfirmation:false,
      warning:'Native product/price write not confirmed; reconcile original audit, do not retry automatically'};
    const id=operation==='product_create'?out.value.resourceId:candidate.id;
    const productRead=await nativeRead('product_get',{productId:id},ctx);
    if(productRead.id!==id||productRead.active!==true||productRead.name!==a.name)
      throw new TypeError('Native product readback did not verify original selection');
    if(operation==='product_create')
      return {...result,done:false,confirmed:true,needsConfirmation:false,
        stage:'await_price_preview',productId:id,
        nextAction:'Provide exact productId and repeat to independently preview/confirm price; no automatic unreviewed second write'};
    const priceRead=await nativeRead('price_list',{lookupKey:a.lookupKey,limit:2},ctx);
    if(priceRead.has_more!==false||priceRead.data?.length!==1||
      !priceMatches(priceRead.data[0],a,id))
      throw new TypeError('Original provider price lookup readback not confirmed');
    return {...result,done:true,confirmed:true,needsConfirmation:false,
      stage:'complete',priceId:priceRead.data[0].id,productId:id};
  }catch{
    return {...result,done:false,confirmed:false,needsConfirmation:false,
      warning:'Native catalog step could have succeeded. Inspect exact audit/product/lookup before retry'};
  }
}
export const handlers={async workflow_set_up_catalog(a,ctx){
  try{return reply(await setup(a,ctx));}catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
}};
