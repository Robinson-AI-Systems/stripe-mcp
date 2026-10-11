// G-4e1: native TEST webhook endpoint maintenance; never expose destination paths or secrets.
import {parseForwardUrl,resolveForwardTarget} from '../dev/forwarder-security.js';
import {defineWrite,gone} from './write.js';
import {client,writeProfiles} from './billing-shared.js';
import {protectAppOwnedTarget} from './app-guard.js';
import {webhookSafe} from './webhooks-read.js';
const reject=m=>{throw new TypeError(m);};
const idOk=v=>typeof v==='string'&&/^we_[A-Za-z0-9]{2,100}$/.test(v);
const descOk=v=>typeof v==='string'&&v.length<=160&&!/[\x00-\x1f\x7f]/.test(v);
function argsOf(a,kind){
  if(!a||typeof a!=='object'||Array.isArray(a)||!idOk(a.endpointId)||
    Object.keys(a).some(k=>!['endpointId','url','description','outsideApp',
      'confirm','dryRun','requestKey'].includes(k))||
    (a.outsideApp!==undefined&&typeof a.outsideApp!=='boolean'))
    reject('Exact TEST webhook endpoint and allowed arguments required');
  if(kind==='delete'&&(a.url!==undefined||a.description!==undefined))
    reject('Delete accepts no destination or description changes');
  if(kind==='update'&&a.url===undefined&&a.description===undefined)
    reject('Select at least one webhook field to update');
  if(a.description!==undefined&&!descOk(a.description))reject('Unsafe description');
  if(a.url!==undefined)parseForwardUrl(a.url);
}
function exact(v,id){
  webhookSafe(v);
  if(v.id!==id||v.application!=null||v.connect===true||
    typeof v.url!=='string'||v.url.length>2048)
    reject('Only verified own-account native TEST webhooks can change');
  return v;
}
function same(before,now){
  return before.id===now.id&&before.created===now.created&&
    before.url===now.url&&before.description===now.description&&
    before.status===now.status&&before.api_version===now.api_version&&
    JSON.stringify(before.metadata??{})===JSON.stringify(now.metadata??{})&&
    JSON.stringify([...before.enabled_events].sort())===
      JSON.stringify([...now.enabled_events].sort());
}
export function makeWebhookMaintenance(kind){
  if(!['update','delete'].includes(kind))reject('Unknown webhook maintenance');
  const name=kind==='delete'?'webhook_delete':'webhook_update';
  return defineWrite({
    name,
    read:async(a,ctx)=>{
      argsOf(a,kind);
      if(ctx?.connection?.mode!=='test')reject('TEST mode only');
      const record=exact(await (await client(ctx)).webhookEndpoints.retrieve(a.endpointId),
        a.endpointId);
      if(kind==='update'&&a.url!==undefined&&a.url!==record.url)
        await resolveForwardTarget(a.url,ctx.services?.webhookDnsLookup?
          {lookup:ctx.services.webhookDnsLookup}:{});
      return record;
    },
    summarize:(record,a)=>{
      const origin=new URL(record.url).origin;
      if(kind==='delete')return 'TEST MODE. Delete native webhook '+record.id+
        ' at '+origin+'. This stops Stripe deliveries to that endpoint.'+
        ' Existing signing credentials are never returned. Requires confirmation.';
      return 'TEST MODE. Change only the selected native webhook destination/description on '+
        record.id+' at '+origin+'. Destination paths, parameters and signing secrets stay private.'+
        ' Event subscriptions remain unchanged.';
    },
    apply:async(a,ctx,{before,idempotencyKey})=>{
      const s=await client(ctx);
      const current=exact(await s.webhookEndpoints.retrieve(a.endpointId),a.endpointId);
      if(await protectAppOwnedTarget(a,ctx,current)!==true)
        reject('App-owned webhook endpoint or unknown ownership');
      if(!same(before,current))reject('Webhook changed after preview; refuse stale mutation');
      if(kind==='delete'){
        const result=await s.webhookEndpoints.del(a.endpointId,{idempotencyKey});
        if(result?.id!==a.endpointId||result?.deleted!==true)
          reject('Stripe did not acknowledge exact webhook deletion');
        return;
      }
      const changes={
        ...(a.url!==undefined?{url:parseForwardUrl(a.url).url}:{}),
        ...(a.description!==undefined?{description:a.description}:{})
      };
      if((changes.url??current.url)===(current.url)&&
        (changes.description??current.description)===current.description)return;
      await s.webhookEndpoints.update(a.endpointId,changes,{idempotencyKey});
    },
    readAfter:async(a,ctx)=>{
      try{return await (await client(ctx)).webhookEndpoints.retrieve(a.endpointId);}
      catch(e){
        if(kind==='delete'&&
          (e?.code==='resource_missing'||e?.raw?.code==='resource_missing')&&
          (e?.statusCode===404||e?.status===404))
          return {id:a.endpointId,deleted:true};
        throw e;
      }
    },
    verify:(before,after,a)=>{
      if(kind==='delete')return after?.id===a.endpointId&&after.deleted===true;
      try{
        exact(after,a.endpointId);
        return after.created===before.created&&
          after.url===(a.url!==undefined?parseForwardUrl(a.url).url:before.url)&&
          after.description===(a.description!==undefined?a.description:before.description)&&
          after.status===before.status&&after.api_version===before.api_version&&
          JSON.stringify([...after.enabled_events].sort())===
            JSON.stringify([...before.enabled_events].sort());
      }catch{return false;}
    }
  });
}
const schema={type:'object',properties:{
  endpointId:{type:'string',pattern:'^we_[A-Za-z0-9]{2,100}$'},
  outsideApp:{type:'boolean'},
  url:{type:'string',minLength:1,maxLength:2048},
  description:{type:'string',maxLength:160},
  requestKey:{type:'string',minLength:1,maxLength:128},
  dryRun:{type:'boolean'},confirm:{type:'boolean'}
},required:['endpointId'],additionalProperties:false};
export const tools=[
  {...makeWebhookMaintenance('update').tool,area:'webhooks',profiles:writeProfiles,
    safety:'P',description:'Guarded native TEST webhook destination/description updates; subscriptions and secrets remain unchanged.',
    inputSchema:schema},
  {...makeWebhookMaintenance('delete').tool,area:'webhooks',profiles:writeProfiles,
    safety:'C',annotations:{destructiveHint:true},
    description:'Guarded irreversible TEST webhook deletion; requires exact provider tombstone and never reveals secrets.',
    inputSchema:{...schema,properties:Object.fromEntries(
      Object.entries(schema.properties).filter(([k])=>!['url','description'].includes(k)))}}
];
export const handlers={
  webhook_update:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Webhook maintenance requires TEST mode'):makeWebhookMaintenance('update').handler(a,ctx),
  webhook_delete:(a,ctx)=>ctx?.connection?.mode!=='test'?
    gone('Webhook maintenance requires TEST mode'):makeWebhookMaintenance('delete').handler(a,ctx)
};
