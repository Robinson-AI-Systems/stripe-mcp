// G-4b: never expose webhook signing secrets or URL bearer-bearing paths.
import {guarded,fail,allProfiles,paging,pageResult,local} from './billing-shared.js';
const invalid=m=>{throw new TypeError(m);};
const validId=x=>typeof x==='string'&&/^we_[A-Za-z0-9]{2,100}$/.test(x);
const validEvent=x=>x==='*'||(typeof x==='string'&&x.length<=140&&
  /^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,75}$/.test(x));
const allowed=['id','status','createdAt','destinationOrigin','enabledEventCount',
  'enabledEvents','moreEnabledEvents','apiVersion'];
const fields={type:'array',maxItems:8,uniqueItems:true,
  items:{type:'string',enum:allowed}};
const detail={type:'string',enum:['summary','full']};
const listSchema={limit:{type:'integer',minimum:1,maximum:5},
  starting_after:{type:'string',pattern:'^we_[A-Za-z0-9]{2,100}$'},
  fields,detail};
const getSchema={endpointId:{type:'string',pattern:'^we_[A-Za-z0-9]{2,100}$'},
  fields,detail};
function validate(a,keys){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!keys.includes(k)))
    invalid('Exact safe webhook read arguments required');
  if(a.detail!==undefined&&!['summary','full'].includes(a.detail))
    invalid('Invalid webhook detail');
  if(a.fields!==undefined&&(!Array.isArray(a.fields)||a.fields.length>8||
    new Set(a.fields).size!==a.fields.length||
    a.fields.some(x=>!allowed.includes(x))))
    invalid('Invalid webhook field selection');
}
function destinationOrigin(url){
  if(typeof url!=='string'||url.length>2048)return null;
  try{
    const p=new URL(url);
    if(p.protocol!=='https:'||!p.hostname||p.username||p.password||p.port)
      return null;
    return p.origin;
  }catch{return null;}
}
export function webhookSafe(v,{detail='summary',select,list=false}={}){
  if(v?.object!=='webhook_endpoint'||!validId(v.id)||v.livemode!==false||
    !Number.isSafeInteger(v.created)||v.created<946684800||
    !['enabled','disabled'].includes(v.status)||
    !Array.isArray(v.enabled_events)||v.enabled_events.length>1000||
    v.enabled_events.some(x=>!validEvent(x))||
    new Set(v.enabled_events).size!==v.enabled_events.length)
    invalid('Exact TEST webhook endpoint metadata unavailable');
  // A webhook URL path or query may contain a bearer credential; publish only its origin.
  const base={id:v.id,status:v.status,createdAt:local(v.created),
    destinationOrigin:destinationOrigin(v.url),
    enabledEventCount:v.enabled_events.length};
  const max=list?8:30,full={...base,
    enabledEvents:v.enabled_events.slice(0,max),
    moreEnabledEvents:v.enabled_events.length>max,
    apiVersion:typeof v.api_version==='string'&&
      /^\d{4}-\d{2}-\d{2}(\.[a-z0-9_]+)?$/.test(v.api_version)?
      v.api_version:null};
  const projected=detail==='full'?full:base;
  if(!select)return projected;
  const keep=new Set(select);
  return Object.fromEntries(Object.entries(projected).filter(([k])=>
    k==='id'||keep.has(k)));
}
export const tools=[
  {name:'webhook_list',area:'webhooks',writes:false,profiles:allProfiles,
    annotations:{readOnlyHint:true},
    description:'List TEST webhook endpoint status and event counts, with destination paths and secrets redacted.',
    inputSchema:{type:'object',properties:listSchema,additionalProperties:false}},
  {name:'webhook_get',area:'webhooks',writes:false,profiles:allProfiles,
    annotations:{readOnlyHint:true},
    description:'Get safe TEST webhook endpoint events and origin; never reveal signing secrets or URL tokens.',
    inputSchema:{type:'object',properties:getSchema,required:['endpointId'],
      additionalProperties:false}}
];
export const handlers={
  webhook_list:(a,ctx)=>ctx?.connection?.mode!=='test'?
    fail('TEST webhook reads only'):guarded(ctx,async s=>{
      validate(a,Object.keys(listSchema));
      const params=paging({limit:a.limit??5,starting_after:a.starting_after});
      if(params.limit>5||(a.starting_after!==undefined&&!validId(a.starting_after)))
        invalid('Invalid webhook cursor or limit');
      return pageResult(await s.webhookEndpoints.list(params),
        v=>webhookSafe(v,{detail:a.detail,select:a.fields,list:true}));
    }),
  webhook_get:(a,ctx)=>ctx?.connection?.mode!=='test'?
    fail('TEST webhook reads only'):guarded(ctx,async s=>{
      validate(a,Object.keys(getSchema));
      if(!validId(a.endpointId))invalid('Exact webhook endpoint ID required');
      const v=await s.webhookEndpoints.retrieve(a.endpointId);
      if(v?.id!==a.endpointId)invalid('Webhook endpoint ID mismatch');
      return webhookSafe(v,{detail:a.detail,select:a.fields});
    })
};
