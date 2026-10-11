// G-4d2: native TEST webhook endpoint creation with owner-only single-view signing secret.
import {createHash} from 'node:crypto';
import {createOneTimeStore} from '../core/one-time-secrets.js';
import {parseForwardUrl,resolveForwardTarget} from '../dev/forwarder-security.js';
import {defineWrite,gone} from './write.js';
import {client,fullProfiles,reply} from './billing-shared.js';
import {webhookSafe} from './webhooks-read.js';
const reject=m=>{throw new TypeError(m);};
const event=x=>typeof x==='string'&&x.length<=100&&
  /^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,75}$/.test(x);
function config(a){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!['url','events','description','requestKey','dryRun','confirm'].includes(k))||
    typeof a.requestKey!=='string'||a.requestKey.length<1||a.requestKey.length>128)
    reject('A stable retry key and exact webhook parameters are required');
  const target=parseForwardUrl(a.url);
  if(!Array.isArray(a.events)||a.events.length<1||a.events.length>25||
    new Set(a.events).size!==a.events.length||a.events.some(x=>!event(x)))
    reject('Specify one to 25 unique named Stripe events');
  if(a.description!==undefined&&(typeof a.description!=='string'||
    a.description.length>160||/[\r\n\x00-\x1f]/.test(a.description)))
    reject('Invalid webhook description');
  const events=[...a.events].sort(),description=a.description??'';
  const digest=createHash('sha256').update(JSON.stringify([target.url,events,description])).digest('hex');
  return {target,events,description,digest};
}
function provider(v,expected){
  webhookSafe(v);
  if(v.application!=null||v.connect===true||v.url!==expected.target.url||
    JSON.stringify([...v.enabled_events].sort())!==JSON.stringify(expected.events))
    reject('Native webhook provider read-back did not match the selected TEST endpoint');
  return v;
}
function store(ctx){
  if(!ctx?.db||['reserveWebhookCreate','completeWebhookCreate','getWebhookCreate']
    .some(k=>typeof ctx.db[k]!=='function'))
    reject('Durable webhook creation ledger unavailable');
  return ctx.db;
}
export function makeWebhookCreate(){
  let newId=null,setupPath=null,issued=false;
  const op=defineWrite({
    name:'webhook_create',
    read:async(a,ctx)=>{
      if(ctx?.connection?.mode!=='test')reject('TEST account required');
      const c=config(a);store(ctx);
      const prior=await ctx.db.getWebhookCreate({accountId:ctx.connection.stripeAccount,
        requestKey:a.requestKey,digest:c.digest});
      if(!prior)await resolveForwardTarget(c.target.url,ctx.services?.webhookDnsLookup?
        {lookup:ctx.services.webhookDnsLookup}:{});
      return {...c,prior,origin:new URL(c.target.url).origin};
    },
    summarize:p=>'TEST MODE. Register one native Stripe webhook at '+p.origin+
      ' with '+p.events.length+' exact event subscriptions. The destination path and Stripe signing secret'+
      ' remain private. An owner password, same-origin browser and CSRF check are required for the'+
      ' one-time 10-minute signing-secret setup page. Same retry key never starts a second create.',
    apply:async(a,ctx,{before,idempotencyKey})=>{
      const db=store(ctx),accountId=ctx.connection.stripeAccount;
      const p={accountId,requestKey:a.requestKey,digest:before.digest};
      const reserved=await db.reserveWebhookCreate(p);
      if(!reserved.newlyReserved)return; // Could be an uncertain previous POST: fail closed.
      const s=await client(ctx);
      const created=await s.webhookEndpoints.create({
        url:before.target.url,enabled_events:before.events,
        ...(before.description?{description:before.description}:{})
      },{idempotencyKey});
      // Stripe only returns the signing secret on native creation. Never audit it.
      if(created?.object!=='webhook_endpoint'||created.livemode!==false||
        !/^we_[A-Za-z0-9]{2,100}$/.test(created.id??'')||
        typeof created.secret!=='string'||!/^whsec_[A-Za-z0-9_\-+=/]{12,256}$/.test(created.secret))
        reject('Native Stripe creation returned no verified signing-secret handoff');
      provider(created,before);
      const once=ctx.services?.webhookOneTimeStore??createOneTimeStore({db});
      const issuedLink=await once.issue({account:accountId,mode:'test',
        kind:'native-webhook-signing-secret',secret:created.secret});
      if(!/^\/api\/stripe\/setup\?show=[A-Za-z0-9_-]{32}$/.test(issuedLink?.setupPath??''))
        reject('Owner-only setup URL could not be issued');
      if(await db.completeWebhookCreate({...p,endpointId:created.id})!==true)
        reject('Native webhook creation could not be durably finalized');
      newId=created.id;setupPath=issuedLink.setupPath;issued=true;
    },
    readAfter:async(a,ctx)=>{
      const c=config(a);
      const result=await store(ctx).getWebhookCreate({
        accountId:ctx.connection.stripeAccount,requestKey:a.requestKey,digest:c.digest});
      if(result?.state!=='confirmed'||!result.endpointId)return null;
      return (await client(ctx)).webhookEndpoints.retrieve(result.endpointId);
    },
    verify:(before,after)=>{
      try{provider(after,before);return true;}catch{return false;}
    }
  });
  return {...op,async handler(a,ctx){
    newId=null;setupPath=null;issued=false;
    if(ctx?.connection?.mode!=='test')return gone('Native webhook creation requires TEST mode');
    const response=await op.handler(a,ctx);
    if(!issued||response?.isError||!setupPath)return response;
    const result=JSON.parse(response.content[0].text);
    if(result.done!==true)return response;
    return reply({...result,endpointId:newId,setupPath,secretShownInTool:false,
      note:'Only the independently authenticated owner can reveal this secret once within 10 minutes. Copy it into the project hosting settings.'});
  }};
}
export const tools=[{...makeWebhookCreate().tool,area:'webhooks',profiles:fullProfiles,safety:'C',
  description:'Create a guarded native TEST webhook; reveal its signing secret only on the independently authenticated one-time owner page.',
  inputSchema:{type:'object',properties:{
    url:{type:'string',minLength:1,maxLength:2048},
    events:{type:'array',minItems:1,maxItems:25,uniqueItems:true,
      items:{type:'string',minLength:3,maxLength:100}},
    description:{type:'string',maxLength:160},
    requestKey:{type:'string',minLength:1,maxLength:128},
    dryRun:{type:'boolean'},confirm:{type:'boolean'}
  },required:['url','events','requestKey'],additionalProperties:false}}];
export const handlers={webhook_create:(a,ctx)=>makeWebhookCreate().handler(a,ctx)};
