// U-1: original authenticated TEST-only pinned API discovery and guarded
// universal resource access. A native curated tool always takes precedence.
import {allProfiles,fullProfiles,client,reply,fail} from './billing-shared.js';
import {defineWrite,gone} from './write.js';
import {findAppOwnership} from './app-guard.js';
import {getOperation,describeOperation,findOperations,checkedRequest}
  from '../stripe/openapi-index.js';
import {financialDecision,isSafeMetadataUpdate}
  from '../stripe/money-operations.js';
import {preferredNative} from '../stripe/hand-built-map.js';

const bad=message=>{throw new TypeError(message);};
const exact=(a,allowed,required=[])=>{
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!allowed.includes(k))||
    required.some(k=>a[k]===undefined))
    bad('Supply only the supported pinned universal arguments');
};
const operationId={type:'string',minLength:1,maxLength:150};
const requestFields={op:operationId,pathParams:{type:'object'},
  query:{type:'object'},body:{type:'object'}};
const writeFields={...requestFields,dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:128}};
const definition=(name,desc,props,required,write=false)=>({
  name,area:'universal',description:desc,
  profiles:write?fullProfiles:allProfiles,writes:write,
  ...(write?{writeContract:'defineWrite-v1',safety:'P',moneySpec:null}:{
    annotations:{readOnlyHint:true}}),
  inputSchema:{type:'object',properties:props,required,additionalProperties:false}
});
export const tools=[
  definition('api_search','Find pinned Stripe operation IDs and safe method/path summaries.',
    {query:{type:'string',minLength:1,maxLength:100},
      limit:{type:'integer',minimum:1,maximum:20}},['query']),
  definition('api_describe','Read pinned Stripe operation path, query, body parameters and policy.',
    {op:operationId},['op']),
  definition('api_read','Call pinned Stripe TEST GET using only validated paths and query fields.',
    {...requestFields},['op']),
  definition('api_write','Preview/confirm a safe original TEST non-money metadata mutation, refusing native-covered operations.',
    {...writeFields},['op'],true)
];
function context(ctx,full=false){
  if(ctx?.connection?.mode!=='test'||!/^acct_[A-Za-z0-9]{2,100}$/.test(
    ctx.connection.stripeAccount??'')||
    (full?ctx.connection.profile!=='full':!allProfiles.includes(ctx.connection.profile)))
    bad('Selected authenticated TEST account/profile required');
}
function currentResult(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    bad('Original Stripe provider returned invalid data');
  // rawRequest in official stripe-node resolves to a StripeResponse resource;
  // in test transports the canonical provider resource may be nested in data.
  const result=raw.object||raw.id||raw.has_more!==undefined?raw:raw.data;
  if(!result||typeof result!=='object'||Array.isArray(result))
    bad('Original Stripe response identity missing');
  if(result.livemode===true)bad('LIVE provider object refused');
  return result;
}
const string=(x,n=180)=>typeof x==='string'&&x.length<=n?x:null;
function publicSafe(v,depth=0){
  if(depth>3)return null;
  if(Array.isArray(v))return v.slice(0,25).map(x=>publicSafe(x,depth+1));
  if(!v||typeof v!=='object')return v===true||v===false||Number.isSafeInteger(v)?
    v:string(v,200);
  const safe=['id','object','status','active','livemode','currency','created',
    'amount','unit_amount','interval','billing_scheme','type','has_more','next',
    'lookup_key','name','product','price','quantity','last4','interval_count',
    'data','metadata'];
  const out={};
  for(const key of safe){
    if(!Object.hasOwn(v,key))continue;
    if(key==='metadata'){
      out.metadataKeys=Object.keys(v.metadata??{}).filter(k=>
        /^[A-Za-z0-9_-]{1,50}$/.test(k)).slice(0,20);
      continue;
    }
    if(key==='name'&&depth>0)continue;
    if((key==='product'||key==='price')&&typeof v[key]==='object')
      out[key]=string(v[key]?.id,120);
    else out[key]=publicSafe(v[key],depth+1);
  }
  return out;
}
function submitted(a){
  const checked=checkedRequest(a.op,{
    pathParams:a.pathParams,query:a.query,body:a.body});
  const {record,path,query,body}=checked;
  return {record,path,query,body};
}
async function provider(method,path,data,ctx,options={}){
  const stripe=await client(ctx);
  if(typeof stripe.rawRequest!=='function')
    bad('Pinned Stripe rawRequest unavailable; universal dispatch disabled');
  // No caller-controlled API version, Stripe account, keys or headers.
  const raw=await stripe.rawRequest(method,path,data,options);
  return currentResult(raw);
}
function rejectSecret(record){
  if(!record.path.startsWith('/v1/')||/\b(secret|ephemeral_keys|tokens|person|bank_account|files|identity\/verification|issuing\/cardholders)\b/i.test(record.path))
    bad('Sensitive universal family requires specialized original native reader');
}
async function read(a,ctx){
  context(ctx);exact(a,['op','pathParams','query'],['op']);
  const {record,path,query}=submitted(a);
  if(record.method!=='GET')bad('api_read accepts only pinned GET operations');
  rejectSecret(record);
  const result=await provider('GET',path,query,ctx);
  if(result.has_more===true&&(!Array.isArray(result.data)||
    result.data.length>100))bad('Unbounded original Stripe provider page');
  return {mode:'test',account:ctx.connection.stripeAccount,
    operationId:record.id,method:'GET',path:record.path,
    provider:publicSafe(result),complete:result.has_more!==true,
    hasMore:result.has_more===true,
    note:'Only a whitelisted safe projection is returned, never raw provider secrets or arbitrary nested PII.'};
}
function safeWrite(a){
  exact(a,['op','pathParams','query','body','dryRun','confirm','requestKey'],['op']);
  const {record,path,body,query}=submitted(a);
  if(record.method!=='POST')bad('Only pinned POST metadata updates are eligible for universal write');
  rejectSecret(record);
  const native=preferredNative(record);
  if(native)bad('Original guarded native tool required: '+native);
  const financial=financialDecision(record,body);
  if(financial.financial)bad(financial.reason);
  if(!isSafeMetadataUpdate(record,body))
    bad('Unclassified universal mutation refused. Only explicitly nonfinancial metadata updates with a safe readback are eligible');
  if(Object.keys(query).length)bad('Universal metadata write query must be empty');
  if(!/\/\{[^}]+\}$/.test(record.path)||!record.root.paths[record.path]?.get)
    bad('Universal metadata update requires original pinned GET readback at same path');
  if(!/\/[A-Za-z0-9_%~-]+$/.test(path))
    bad('Exact Stripe object identifier required');
  return {record,path,body};
}
function makeWrite(){
  let beforeSnapshot=null,afterSnapshot=null;
  return defineWrite({
    name:'api_write',
    read:async(a,ctx)=>{
      context(ctx,true);
      const {path,record,body}=safeWrite(a);
      beforeSnapshot=await provider('GET',path,{},ctx);
      if(!beforeSnapshot.id||typeof beforeSnapshot.metadata!=='object'||
        beforeSnapshot.livemode!==false)
        bad('Exact original TEST target metadata and identity unavailable');
      const owner=await findAppOwnership(beforeSnapshot,ctx);
      if(owner)bad('App-owned or unknown original Stripe record cannot use universal write');
      return {...beforeSnapshot,_operation:record.id,_path:path,
        _keys:Object.keys(body.metadata)};
    },
    summarize:(before,a)=>'TEST: original pinned metadata-only Stripe update '+
      before._operation+' on '+before.id+'; only keys '+
      before._keys.slice(0,15).join(', ')+'. Original provider readback required; no LIVE or money action.',
    targetGuard:async(_a,ctx,before)=>{
      if(await findAppOwnership(before,ctx))return 'App-owned or unverified original target';
      if(before?._operation!==_a.op)return 'Original pinned operation changed';
      return true;
    },
    apply:async(a,ctx,{idempotencyKey})=>{
      const {path,body}=safeWrite(a);
      afterSnapshot=await provider('POST',path,body,ctx,{idempotencyKey});
      if(afterSnapshot.id!==beforeSnapshot.id)bad('Original provider update identity mismatch');
    },
    readAfter:async(a,ctx)=>provider('GET',safeWrite(a).path,{},ctx),
    verify:(before,after,a)=>after?.id===before.id&&
      after.livemode===false&&
      Object.entries(a.body.metadata).every(([k,v])=>after.metadata?.[k]===v),
    resultId:(_before,after)=>after?.id??null
  });
}
export const handlers={
  api_search:async a=>{try{
    exact(a,['query','limit'],['query']);
    return reply({version:'2026-09-30.endive',results:findOperations(a.query,a.limit??15),
      classification:'Non-GET operations need independent preview; financial unknowns fail closed'});
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}},
  api_describe:async a=>{try{
    exact(a,['op'],['op']);return reply(describeOperation(a.op));
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}},
  api_read:async(a,ctx)=>{try{return reply(await read(a,ctx));}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}},
  api_write:(a,ctx)=>ctx?.connection?.mode==='test'&&ctx.connection.profile==='full'?
    makeWrite().handler(a,ctx):gone('Only full original TEST account with native guarded approval')
};
