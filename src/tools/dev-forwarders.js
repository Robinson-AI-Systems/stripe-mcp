// V-4b2: TEST-only forwarding registration and safe owner-scoped management.
// Only a password-authenticated owner setup POST ever reveals signing material.
import {randomBytes,createHash} from 'node:crypto';
import {encryptSecret} from '../core/crypto.js';
import {createOneTimeStore} from '../core/one-time-secrets.js';
import {parseForwardUrl,resolveForwardTarget} from '../dev/forwarder-security.js';
import {defineWrite,gone} from './write.js';
import {reply,allProfiles,writeProfiles} from './billing-shared.js';

const accountId = x => typeof x==='string'&&/^acct_[A-Za-z0-9]+$/.test(x);
const validId = x => typeof x==='string'&&/^fwd_[a-f0-9]{32}$/.test(x);
const requestKey = x => typeof x==='string'&&x.length>=1&&x.length<=128;
const requireTest = ctx => {
  const account=ctx?.connection?.stripeAccount;
  if(ctx?.connection?.mode!=='test'||!accountId(account))
    throw new TypeError('A selected Stripe TEST account is required');
  return account;
};
function typesOf(input){
  if(!Array.isArray(input)||input.length<1||input.length>25||
    input.some(t=>typeof t!=='string'||
      !/^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,80}$/.test(t))||
    new Set(input).size!==input.length)
    throw new TypeError('Choose 1–25 distinct Stripe event types');
  return [...input].sort();
}
function requireCreate(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['url','types','requestKey','confirm','dryRun'].includes(k))||
    !requestKey(a.requestKey))
    throw new TypeError('A stable requestKey and exact TEST forwarder configuration are required');
  const url=parseForwardUrl(a.url).url;
  const types=typesOf(a.types);
  const configDigest=createHash('sha256')
    .update(JSON.stringify([url,types])).digest('hex');
  return {url,types,configDigest};
}
function scopedStore(ctx,methods){
  for(const method of methods)if(typeof ctx?.db?.[method]!=='function')
    throw new TypeError('Durable account-scoped forwarder store is unavailable');
  return ctx.db;
}
function safeRow(row){
  return {id:row.id,url:row.url,types:row.types,
    createdAt:row.created_at??null,lastUsedAt:row.last_used_at??null};
}
export function makeDevForwarderCreateWrite({encryptionKey}={}){
  let inserted=null,setupPath=null;
  const op=defineWrite({
    name:'dev_create_forwarder',
    read:async(a,ctx)=>{
      const account= requireTest(ctx);
      const {url,types,configDigest}=requireCreate(a);
      const db=scopedStore(ctx,['getDevForwarderByRequestKey','ensureDevForwarder',
        'getDevForwarder']);
      const prior=await db.getDevForwarderByRequestKey({
        accountId:account,requestKey:a.requestKey});
      if(prior && (prior.deleted_at||prior.config_digest!==configDigest||
        prior.url!==url||prior.types?.join('|')!==types.join('|')))
        throw new TypeError('Retry key belongs to a different or deleted TEST forwarder');
      // This is only a preflight; V-4c MUST resolve again and pin the IP for
      // each actual HTTPS delivery. Never trust registration-time DNS for sending.
      if(!prior)await resolveForwardTarget(url,ctx.services?.forwarderDnsLookup?
        {lookup:ctx.services.forwarderDnsLookup}:{});
      return {account,url,types,configDigest,prior};
    },
    summarize:p=>'TEST MODE. Register webhook target '+p.url+
      ' for '+p.types.join(', ')+'. Creates no Stripe Event or outbound request. '+
      'An owner password is needed to reveal its signing secret exactly once '+
      'at the private setup URL. Reusing this retry key never rotates credentials.',
    apply:async(a,ctx,{before})=>{
      const db=ctx.db;
      if(before.prior){
        inserted={id:before.prior.id,newlyCreated:false};
        return;
      }
      const id='fwd_'+randomBytes(16).toString('hex');
      const secret='whsec_'+randomBytes(32).toString('base64url');
      const secretEnc=encryptSecret(secret,{
        aad:'stripe-dev-forwarder/'+before.account+'/'+id,
        ...(encryptionKey?{key:encryptionKey}:{})
      });
      // Issue before insertion: storage failure must never leave a registered
      // forwarder whose signing secret cannot be revealed. Unreferenced,
      // unreturned one-time links expire automatically after ten minutes.
      const once=ctx.services?.forwarderOneTimeStore??
        createOneTimeStore({db});
      const issued=await once.issue({
        account:before.account,mode:'test',kind:'webhook-secret',secret});
      if(typeof issued?.setupPath!=='string'||
        !/^\/api\/stripe\/setup\?show=[A-Za-z0-9_-]{32}$/.test(issued.setupPath))
        throw new TypeError('Owner-only one-time secret handoff is unavailable');
      inserted=await db.ensureDevForwarder({
        accountId:before.account,id,requestKey:a.requestKey,
        url:before.url,types:before.types,
        configDigest:before.configDigest,secretEnc
      });
      // Concurrent duplicate registration must not return a second signing
      // secret link. An orphaned one-time record is inaccessible and expires.
      if(inserted.newlyCreated)setupPath=issued.setupPath;
    },
    readAfter:(a,ctx)=>ctx.db.getDevForwarder({
      accountId:ctx.connection.stripeAccount,id:inserted?.id}),
    verify:(before,after)=>!!after&&after.id===inserted?.id&&
      after.url===before.url&&
      Array.isArray(after.types)&&after.types.join('|')===before.types.join('|')
  });
  return {...op,async handler(a,ctx){
    // An identical retry must never inherit a previous invocation's reveal URL.
    inserted=null;
    setupPath=null;
    if(ctx?.connection?.mode!=='test')return gone('Forwarder creation is TEST only');
    const response=await op.handler(a,ctx);
    if(!setupPath||response?.isError)return response;
    const result=JSON.parse(response.content[0].text);
    if(result.done!==true)return response;
    return reply({...result,forwarderId:inserted.id,
      setupPath,secretShownInTool:false,
      note:'Open this owner-only setup link within 10 minutes; sign in and copy the secret once. It is never returned in MCP.'});
  }};
}
export function makeDevForwarderDeleteWrite(){
  const op=defineWrite({
    name:'dev_delete_forwarder',
    read:async(a,ctx)=>{
      const account=requireTest(ctx);
      if(!a||typeof a!=='object'||Array.isArray(a)||
        Object.keys(a).some(k=>!['forwarderId','requestKey','confirm','dryRun'].includes(k))||
        !validId(a.forwarderId)||!requestKey(a.requestKey))
        throw new TypeError('Exact TEST forwarder ID and stable requestKey required');
      const db=scopedStore(ctx,['getDevForwarder','deleteDevForwarder']);
      const row=await db.getDevForwarder({accountId:account,
        id:a.forwarderId,includeDeleted:true});
      if(!row)throw new TypeError('Forwarder not found for this Stripe account');
      return {account,row};
    },
    summarize:p=>'TEST MODE. Permanently disable forwarder '+p.row.id+
      ' targeting '+p.row.url+
      '. All later event delivery is denied; signing credentials are not returned.',
    apply:async(_a,ctx,{before})=>{
      if(!before.row.deleted_at)await ctx.db.deleteDevForwarder({
        accountId:before.account,id:before.row.id});
    },
    readAfter:(a,ctx)=>ctx.db.getDevForwarder({
      accountId:ctx.connection.stripeAccount,id:a.forwarderId}),
    verify:(_before,after)=>after===null
  });
  return {...op,async handler(a,ctx){
    if(ctx?.connection?.mode!=='test')return gone('Forwarder deletion is TEST only');
    return op.handler(a,ctx);
  }};
}
export const tools=[
  {...makeDevForwarderCreateWrite().tool,area:'developer',profiles:writeProfiles,
    description:'Register a public HTTPS TEST webhook target; signing secret is shown only on an authenticated one-time setup page.',
    inputSchema:{type:'object',properties:{
      url:{type:'string',minLength:1,maxLength:2048},
      types:{type:'array',minItems:1,maxItems:25,uniqueItems:true,
        items:{type:'string',minLength:3,maxLength:142}},
      requestKey:{type:'string',minLength:1,maxLength:128},
      confirm:{type:'boolean'},dryRun:{type:'boolean'}
    },required:['url','types','requestKey'],additionalProperties:false}},
  {name:'dev_list_forwarders',area:'developer',writes:false,
    profiles:allProfiles,description:'List only active TEST forwarder URLs and filters for this account; never read secrets.',
    annotations:{readOnlyHint:true},
    inputSchema:{type:'object',properties:{
      limit:{type:'integer',minimum:1,maximum:50},
      offset:{type:'integer',minimum:0,maximum:10000}
    },additionalProperties:false}},
  {...makeDevForwarderDeleteWrite().tool,area:'developer',profiles:writeProfiles,
    description:'Guarded soft-delete of an exact selected-account TEST forwarder; future event delivery is disabled.',
    inputSchema:{type:'object',properties:{
      forwarderId:{type:'string',pattern:'^fwd_[a-f0-9]{32}$'},
      requestKey:{type:'string',minLength:1,maxLength:128},
      confirm:{type:'boolean'},dryRun:{type:'boolean'}
    },required:['forwarderId','requestKey'],additionalProperties:false}}
];
export const handlers={
  dev_create_forwarder:(a,ctx)=>makeDevForwarderCreateWrite().handler(a,ctx),
  dev_list_forwarders:async(a,ctx)=>{
    if(ctx?.connection?.mode!=='test')return gone('Forwarder listing is TEST only');
    const account=requireTest(ctx);
    if(!a||typeof a!=='object'||Array.isArray(a)||
      Object.keys(a).some(k=>!['limit','offset','fields','detail'].includes(k)))
      return gone('Only bounded listing arguments are supported');
    const {limit=20,offset=0}=a;
    if(!Number.isInteger(limit)||limit<1||limit>50||
      !Number.isInteger(offset)||offset<0||offset>10000)
      return gone('Invalid forwarder pagination');
    const db=scopedStore(ctx,['listDevForwarders']);
    const rows=await db.listDevForwarders({accountId:account,limit,offset});
    return reply({account,mode:'test',data:rows.map(safeRow),
      hasMore:rows.length===limit,nextOffset:rows.length===limit?offset+limit:null});
  },
  dev_delete_forwarder:(a,ctx)=>makeDevForwarderDeleteWrite().handler(a,ctx)
};
