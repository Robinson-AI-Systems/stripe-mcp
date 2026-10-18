// G-4c: one guarded TEST endpoint change, preserving unrelated subscriptions.
import {defineWrite,gone} from './write.js';
import {writeProfiles,validateFields} from './billing-shared.js';
import {webhookClient,isWebhookMode} from './webhook-mode.js';
import {authorizeLiveWrite} from './live-guard.js';
import {protectAppOwnedTarget} from './app-guard.js';
import {webhookSafe} from './webhooks-read.js';

const invalid=message=>{throw new TypeError(message);};
const endpoint={type:'string',pattern:'^we_[A-Za-z0-9]{2,100}$'};
const props={endpointId:endpoint,events:{type:'array'},
  outsideApp:{type:'boolean'}};
const controls={dryRun:{type:'boolean'},confirm:{type:'boolean'},
  requestKey:{type:'string',minLength:1,maxLength:128}};
const isEvent=v=>typeof v==='string'&&v.length<=100&&
  /^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,75}$/.test(v);
function requested(a){
  validateFields(a,props,['endpointId']);
  if(!Array.isArray(a.events)||a.events.length<1||a.events.length>8||
    a.events.some(x=>!isEvent(x))||
    new Set(a.events).size!==a.events.length)
    invalid('Provide one to eight distinct named Stripe event types');
  return a.events;
}
function exact(v,id,mode='test'){
  webhookSafe(v,{detail:'summary',mode});
  if(v.id!==id||v.application!=null||v.connect===true)
    invalid('Only own-account selected-mode webhook endpoints can change subscriptions');
  if(v.enabled_events.includes('*'))
    invalid('Wildcard webhook subscriptions require separate Dashboard handling');
  if(typeof v.url!=='string'||v.url.length>2048)
    invalid('Complete webhook destination unavailable');
  return v;
}
const sorted=values=>[...values].sort();
function plan(v,a,kind){
  const events=requested(a),old=new Set(v.enabled_events);
  const next=kind==='add'?
    sorted([...new Set([...old,...events])]):
    sorted([...old].filter(x=>!events.includes(x)));
  if(next.length<1||next.length>1000)
    invalid('Webhook endpoint must retain a bounded nonempty subscription set');
  return {next,changed:next.length!==old.size,events};
}
function same(a,b){
  return a.id===b.id&&a.created===b.created&&a.status===b.status&&
    a.url===b.url&&a.description===b.description&&
    a.api_version===b.api_version&&a.application===b.application&&
    JSON.stringify(a.metadata??{})===JSON.stringify(b.metadata??{})&&
    JSON.stringify(sorted(a.enabled_events))===JSON.stringify(sorted(b.enabled_events));
}
async function preflight(a,ctx,kind){
  requested(a);
  const v=exact(await (await webhookClient(ctx)).webhookEndpoints.retrieve(a.endpointId),
    a.endpointId,ctx.connection.mode);
  plan(v,a,kind);
  return v;
}
export function makeWebhookEventChange(kind){
  if(!['add','remove'].includes(kind))invalid('Unknown webhook subscription change');
  const name=kind==='add'?'webhook_add_events':'webhook_remove_events';
  return defineWrite({
    name,
    read:(a,ctx)=>preflight(a,ctx,kind),
    modeGuard:(_a,ctx)=>authorizeLiveWrite({ctx}),
    summarize:(before,a,ctx)=>{
      const p=plan(before,a,kind);
      return ctx.connection.mode.toUpperCase()+' MODE. '+(kind==='add'?'ADD':'REMOVE')+' exact event subscriptions ['+
        p.events.join(', ')+'] on webhook '+before.id+
        '. Existing unrelated subscriptions and secret destination stay unchanged.'+
        (p.changed?'':' All requested events already have the desired state; no API write.');
    },
    apply:async(a,ctx,{before,idempotencyKey})=>{
      const s=await webhookClient(ctx);
      // Stripe has no compare-and-swap for this resource. Reduce stale-plan risk
      // with a second complete provider fetch and app-ownership check just before POST.
      const latest=exact(await s.webhookEndpoints.retrieve(a.endpointId),a.endpointId,
        ctx.connection.mode);
      const allowed=await protectAppOwnedTarget(a,ctx,latest);
      if(allowed!==true)invalid('App-owned webhook endpoint or unknown ownership');
      if(!same(before,latest))
        invalid('Webhook changed since preflight; refusing stale event replacement');
      const p=plan(latest,a,kind);
      if(p.changed){
        await s.webhookEndpoints.update(a.endpointId,
          {enabled_events:p.next},{idempotencyKey});
      }
    },
    readAfter:async(a,ctx)=>
      (await webhookClient(ctx)).webhookEndpoints.retrieve(a.endpointId),
    inverse:async(before,after,a)=>{
      const original=sorted(before.enabled_events),next=sorted(after.enabled_events);
      if(original.length>30||next.length>30||original.includes('*')||
        next.includes('*')||JSON.stringify(original)===JSON.stringify(next))return null;
      const removed=original.filter(e=>!next.includes(e)),
        added=next.filter(e=>!original.includes(e));
      if((added.length>0&&removed.length>0)||
        Math.max(added.length,removed.length)>8)return null;
      const tool=added.length>0?'webhook_remove_events':'webhook_add_events';
      return {version:1,tool,args:{endpointId:a.endpointId,
        events:added.length>0?added:removed},readTool:'webhook_get',
        readArgs:{endpointId:a.endpointId,detail:'full'},
        expected:{enabledEvents:next,moreEnabledEvents:false},
        restored:{enabledEvents:original,moreEnabledEvents:false}};
    },
    verify:(before,after,a,ctx)=>{
      try{
        exact(after,a.endpointId,ctx.connection.mode);
        const p=plan(before,a,kind);
        return after.created===before.created&&after.status===before.status&&
          after.url===before.url&&after.api_version===before.api_version&&
          JSON.stringify(sorted(after.enabled_events))===JSON.stringify(p.next);
      }catch{return false;}
    }
  });
}
const add=makeWebhookEventChange('add'),remove=makeWebhookEventChange('remove');
const schema={type:'object',properties:{
  ...props,events:{type:'array',minItems:1,maxItems:8,uniqueItems:true,
    items:{type:'string',minLength:3,maxLength:100}},...controls},
  required:['endpointId','events'],additionalProperties:false};
export const tools=[
  {...add.tool,area:'webhooks',profiles:writeProfiles,safety:'P',
    description:'Guarded selected TEST/LIVE webhook event additions preserving all unrelated subscriptions.',
    inputSchema:schema},
  {...remove.tool,area:'webhooks',profiles:writeProfiles,safety:'C',
    annotations:{destructiveHint:true},
    description:'Guarded selected TEST/LIVE webhook event removals preserving unrelated subscriptions.',
    inputSchema:schema}
];
export const handlers={
  webhook_add_events:(a,ctx)=>!isWebhookMode(ctx)?
    gone('Selected Stripe mode required'):
    makeWebhookEventChange('add').handler(a,ctx),
  webhook_remove_events:(a,ctx)=>!isWebhookMode(ctx)?
    gone('Selected Stripe mode required'):
    makeWebhookEventChange('remove').handler(a,ctx)
};
