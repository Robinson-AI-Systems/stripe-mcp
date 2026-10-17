// U-1: pinned mode-bound provider discovery and guarded universal execution.
// Developer TEST-only credentials must not restrict an owner-authorized LIVE pass.
import {allProfiles,fullProfiles,reply,fail} from './billing-shared.js';
import {compact} from './util.js';
import {readDetail} from './result-rules.js';
import {defineWrite,gone} from './write.js';
import {findAppOwnership} from './app-guard.js';
import {getOperation,describeOperation,findOperations,checkedRequest}
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
  definition('api_read','Read selected Stripe provider GET with safe summary/full field projection.',
    {...requestFields,detail:{type:'string',enum:['summary','full']},
      fields:{type:'string',maxLength:600}},['op']),
  definition('api_write','Preview confirmed guarded Stripe POST/DELETE; financial and ownership gates remain independent.',
    {...writeFields},['op'],true)
];
function context(ctx,full=false){
  if(!['test','live'].includes(ctx?.connection?.mode)||!/^acct_[A-Za-z0-9]{2,100}$/.test(
    ctx.connection.stripeAccount??'')||
    (full?ctx.connection.profile!=='full':!allProfiles.includes(ctx.connection.profile)))
    bad('Selected authenticated Stripe account/profile required');
}
function currentResult(raw,mode){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))
    bad('Original Stripe provider returned invalid data');
  // rawRequest in official stripe-node resolves to a StripeResponse resource;
  // in test transports the canonical provider resource may be nested in data.
  const result=raw.object||raw.id||raw.has_more!==undefined?raw:raw.data;
  if(!result||typeof result!=='object'||Array.isArray(result))
    bad('Original Stripe response identity missing');
  if(typeof result.livemode==='boolean'&&result.livemode!==(mode==='live'))
    bad('Provider response does not match authenticated account mode');
  return result;
}
function submitted(a){
  const checked=checkedRequest(a.op,{
    pathParams:a.pathParams,query:a.query,body:a.body});
  const {record,path,query,body}=checked;
  return {record,path,query,body};
}
async function provider(method,path,data,ctx,options={}){
  // Only the server-owned factory can load the selected encrypted key; in
  // LIVE mode it independently verifies production and account activation.
  if(typeof ctx?.services?.stripeForConnection!=='function')
    bad('Authenticated Stripe provider unavailable');
  const stripe=await ctx.services.stripeForConnection(ctx.connection);
  if(typeof stripe.rawRequest!=='function')
    bad('Pinned Stripe rawRequest unavailable; universal dispatch disabled');
  // No caller-controlled API version, Stripe account, keys or headers.
  const raw=await stripe.rawRequest(method,path,data,options);
  return currentResult(raw,ctx.connection.mode);
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
  const projected=readDetail(compact(result,{mode:ctx.connection.mode}),{
    detail:a.detail??'summary',fields:a.fields});
  if(Buffer.byteLength(JSON.stringify(projected),'utf8')>8192)
    bad('Selected read exceeds safe result budget; use fields or a narrower provider limit');
  return {mode:ctx.connection.mode,account:ctx.connection.stripeAccount,
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
function matchesProvider(request,returned){
  if(request===null||typeof request!=='object')return request===returned;
  if(Array.isArray(request))return Array.isArray(returned)&&
    request.length===returned.length&&
    request.every((v,i)=>matchesProvider(v,returned[i]));
  return !!returned&&typeof returned==='object'&&
    Object.entries(request).every(([k,v])=>matchesProvider(v,returned[k]));
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
        {id:ctx.connection.stripeAccount,metadata:{},
          livemode:ctx.connection.mode==='live',
          _newResource:true}:await get(command.path,ctx);
      if(!obj?.id||obj.livemode!==(ctx.connection.mode==='live')||
        typeof obj.metadata!=='object'||obj.metadata===null)
        bad('Mode-bound target identity/ownership metadata unavailable');
      const owner=await findAppOwnership(obj,ctx);
      if(owner?.unknown)bad('Cannot establish Stripe application ownership');
      command.originalId=obj.id;
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
      if(typeof created?.id!=='string'||
        created.livemode!==(ctx.connection.mode==='live'))
        bad('Original Stripe response identity unverified');
      if(cmd.policy.kind!=='create'&&created.id!==command.originalId)
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
            return {id:created.id,livemode:ctx.connection.mode==='live',deleted:true};
          throw error;
        }
      }
      return get(command.path,ctx);
    },
    verify:(before,after,_a,ctx)=>{
      if(!after||after.livemode!==(ctx.connection.mode==='live'))return false;
      if(command.policy.kind==='create')
        return after.id===created?.id&&after.id!==before.id&&
          Object.entries(command.body).every(([key,value])=>
            matchesProvider(value,after[key]));
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
    return reply({version:'2026-09-30.endive',
      results:findOperations(a.query,a.limit??15).map(x=>{
        const op=getOperation(x.operationId);
        return {...x,classification:op.method==='GET'?'READ':
          preferredNative(op)?'CURATED_NATIVE_WRITE':
          financialDecision(op).financial?'MONEY_OR_UNCLASSIFIED':
            'REQUIRES_POLICY_EVALUATION'};
      }),note:'Unknown money operations need a provider-derived exact amount and owner grant, never inferred $0.'});
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}},
  api_describe:async a=>{try{
    exact(a,['op'],['op']);const op=getOperation(a.op);
    return reply({...describeOperation(a.op),preferredNative:preferredNative(op)??null,
      financialOrUnclassified:financialDecision(op).financial,
      warnings:['Provider charges and irreversible effects may be unknown','Money out requires independent owner approval for exact provider-derived amount']});
  }catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}},
  api_read:async(a,ctx)=>{try{return reply(await read(a,ctx));}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}},
  api_write:async(a,ctx)=>{
    if(!['test','live'].includes(ctx?.connection?.mode)||ctx.connection.profile!=='full')
      return gone('Only authenticated full Stripe scope with guarded approval');
    try{return await makeWrite()(a,ctx);}
    catch(e){if(e instanceof TypeError)return fail(e.message);throw e;}
  }
};
