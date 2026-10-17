// U-1: original authenticated TEST-only pinned API discovery and guarded
// universal resource access. A native curated tool always takes precedence.
import {allProfiles,fullProfiles,client,reply,fail} from './billing-shared.js';
import {compact} from './util.js';
import {readDetail} from './result-rules.js';
import {defineWrite,gone} from './write.js';
import {findAppOwnership} from './app-guard.js';
import {describeOperation,findOperations,checkedRequest}
  from '../stripe/openapi-index.js';
import {financialDecision,isSafeMetadataUpdate}
  from '../stripe/money-operations.js';
import {preferredNative} from '../stripe/hand-built-map.js';
import {classifyUniversalWrite,companionGet} from '../stripe/universal-policy.js';

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
const writeFields={...requestFields,outsideApp:{type:'boolean'},
  dryRun:{type:'boolean'},confirm:{type:'boolean'},
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
  definition('api_write','Preview confirmed guarded Stripe POST/DELETE; financial and ownership gates remain independent.',
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
  context(ctx);exact(a,['op','pathParams','query','detail','fields'],['op']);
  const {record,path,query}=submitted(a);
  if(record.method!=='GET')bad('api_read accepts only pinned GET operations');
  rejectSecret(record);
  const result=await provider('GET',path,query,ctx);
  if(result.has_more===true&&(!Array.isArray(result.data)||
    result.data.length>100))bad('Unbounded original Stripe provider page');
  const projected=readDetail(compact(result,{mode:'test'}),{
    detail:a.detail??'summary',fields:a.fields});
  if(Buffer.byteLength(JSON.stringify(projected),'utf8')>8192)
    bad('Selected read exceeds safe result budget; use fields or a narrower provider limit');
  return {mode:'test',account:ctx.connection.stripeAccount,
    operationId:record.id,method:'GET',path:record.path,
    provider:projected,complete:result.has_more!==true,
    hasMore:result.has_more===true,
    note:'Selected account fields only; credentials redacted, and incomplete pages are not absence proofs.'};
}
function safeWrite(a){
  exact(a,['op','pathParams','query','body','outsideApp','dryRun','confirm','requestKey'],['op']);
  if(a.outsideApp!==undefined&&typeof a.outsideApp!=='boolean')
    bad('outsideApp must be Boolean');
  const {record,path,body,query}=submitted(a);
  if(!['POST','DELETE'].includes(record.method))
    bad('Only pinned POST and DELETE can be written');
  rejectSecret(record);
  const native=preferredNative(record);
  if(native)bad('Use original independently guarded native tool: '+native);
  const policy=classifyUniversalWrite(record,body,{
    metadataOnly:isSafeMetadataUpdate(record,body),
    moneyLike:financialDecision(record,body).financial});
  if(!policy.allowed)bad(policy.reason);
  if(Object.keys(query).length)bad('Universal write query unsupported; use original native tool');
  return {record,path,body,policy};
}
function makeWrite(){
  // Mutable receipt state exists only within this individual tool invocation.
  let command=null,created=null;
  const get=(path,ctx)=>provider('GET',path,{},ctx,{maxNetworkRetries:0});
  return defineWrite({
    name:'api_write',
    read:async(a,ctx)=>{
      context(ctx,true);
      command=safeWrite(a);
      const obj=command.policy.kind==='create'?
        {id:ctx.connection.stripeAccount,metadata:{},livemode:false,
          _newResource:true}:await get(command.path,ctx);
      if(!obj?.id||obj.livemode!==false||
        typeof obj.metadata!=='object'||obj.metadata===null)
        bad('Original TEST target identity/ownership metadata unavailable');
      const owner=await findAppOwnership(obj,ctx);
      if(owner?.unknown)bad('Cannot establish Stripe application ownership');
      return {...obj,_operation:command.record.id};
    },
    summarize:(_before,_a)=>
      'Stripe '+command.record.method+' '+command.record.path+
      ': '+command.policy.notice+
      '. Real provider costs or irreversible effects may be unknown; independent confirmation and verified readback required. No automatic uncertain retry.',
    apply:async(a,ctx,{idempotencyKey})=>{
      const cmd=safeWrite(a);
      created=await provider(cmd.record.method,cmd.path,cmd.body,ctx,{
        idempotencyKey,maxNetworkRetries:0});
      if(typeof created?.id!=='string'||created.livemode===true)
        bad('Original Stripe response identity unverified');
      if(cmd.policy.kind!=='create'&&created.id!==command?.originalId&&
        created.id!==a.pathParams?.[Object.keys(a.pathParams??{})[0]])
        bad('Stripe mutation returned a different resource');
    },
    readAfter:async(_a,ctx)=>{
      if(!created)return null;
      if(command.policy.kind==='create'){
        const route=companionGet(command.record);
        return route?get(route.replace(/\{[^}]+\}/,
          encodeURIComponent(created.id)),ctx):null;
      }
      if(command.policy.kind==='delete'){
        if(created.deleted!==true)return null;
        try{
          const still=await get(command.path,ctx);
          return {id:still?.id,livemode:still?.livemode,deleted:false};
        }catch(error){
          if(error?.statusCode===404||error?.statusCode===410)
            return {id:created.id,livemode:false,deleted:true};
          throw error;
        }
      }
      return get(command.path,ctx);
    },
    verify:(before,after,a)=>{
      if(!after||after.livemode!==false)return false;
      if(command.policy.kind==='create')
        return after.id===created?.id&&after.id!==before.id;
      if(command.policy.kind==='delete')
        return after.id===before.id&&after.deleted===true;
      if(after.id!==before.id)return false;
      return Object.entries(command.body).every(([key,value])=>{
        if(key==='metadata')return Object.entries(value).every(([k,v])=>
          after.metadata?.[k]===v);
        return value===null||typeof value!=='object'?
          after[key]===value:false;
      });
    },
    resultId:(_before,after)=>after?.id??null
  }).handler;
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
  api_write:async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test'||ctx.connection.profile!=='full')
      return gone('Only full original TEST account with native guarded approval');
    try{return await makeWrite()(a,ctx);}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
