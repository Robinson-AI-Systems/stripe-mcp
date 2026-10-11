// G-4a: Stripe Event payloads contain version-dependent private data.
import {client,guarded,fail,allProfiles,paging,pageResult,local} from './billing-shared.js';

const invalid=message=>{throw new TypeError(message);};
const eventId=v=>typeof v==='string'&&/^evt_[A-Za-z0-9]{2,100}$/.test(v);
const eventType=v=>typeof v==='string'&&v.length<=140&&
  /^[a-z][a-z0-9_]{1,60}\.[a-z][a-z0-9_.]{1,75}$/.test(v);
const allowedFields=['id','type','createdAt','objectId','objectType',
  'pendingWebhooks','apiVersion'];
const listSchema={limit:{type:'integer',minimum:1,maximum:25},
  starting_after:{type:'string',pattern:'^evt_[A-Za-z0-9]{2,100}$'},
  type:{type:'string',minLength:3,maxLength:140},
  types:{type:'array',minItems:1,maxItems:20,uniqueItems:true,
    items:{type:'string',minLength:3,maxLength:140}},
  createdGte:{type:'integer',minimum:946684800,maximum:4102444800},
  fields:{type:'array',maxItems:7,uniqueItems:true,
    items:{type:'string',enum:allowedFields}},
  detail:{type:'string',enum:['summary','full']}};
const getSchema={eventId:{type:'string',pattern:'^evt_[A-Za-z0-9]{2,100}$'},
  fields:listSchema.fields,detail:listSchema.detail};
function validate(a,allowed){
  if(!a||typeof a!=='object'||Array.isArray(a)||
    Object.keys(a).some(k=>!allowed.includes(k)))
    invalid('Only documented Event read arguments are allowed');
  if(a.detail!==undefined&&!['summary','full'].includes(a.detail))
    invalid('Invalid Event detail');
  if(a.fields!==undefined&&(!Array.isArray(a.fields)||a.fields.length>7||
    new Set(a.fields).size!==a.fields.length||
    a.fields.some(k=>!allowedFields.includes(k))))
    invalid('Invalid Event fields');
}
export function eventSafe(v,{detail='summary',select}={}){
  if(v?.object!=='event'||!eventId(v.id)||v.livemode!==false||
    !Number.isSafeInteger(v.created)||v.created<946684800||!eventType(v.type))
    invalid('Exact TEST Stripe Event unavailable');
  const source=v.data?.object;
  const objectId=typeof source?.id==='string'&&
    /^[a-z][a-z0-9]{0,9}_[A-Za-z0-9_]{2,100}$/.test(source.id)?source.id:null;
  const objectType=typeof source?.object==='string'&&
    /^[a-z][a-z0-9_]{1,64}$/.test(source.object)?source.object:null;
  const summary={id:v.id,type:v.type,createdAt:local(v.created)};
  const full={...summary,objectId,objectType,
    pendingWebhooks:Number.isSafeInteger(v.pending_webhooks)&&v.pending_webhooks>=0?
      v.pending_webhooks:null,
    apiVersion:typeof v.api_version==='string'&&
      /^\d{4}-\d{2}-\d{2}(\.[a-z0-9_]+)?$/.test(v.api_version)?
      v.api_version:null};
  const permitted=detail==='full'?full:summary;
  if(!select)return permitted;
  const keep=new Set(select);
  return Object.fromEntries(Object.entries(permitted).filter(([k])=>
    k==='id'||keep.has(k)));
}
function listParams(a,undelivered){
  validate(a,Object.keys(listSchema));
  if(a.type!==undefined&&!eventType(a.type))invalid('Invalid Event type');
  if(a.types!==undefined&&(!Array.isArray(a.types)||a.types.length<1||
    a.types.length>20||new Set(a.types).size!==a.types.length||
    a.types.some(t=>!eventType(t))))invalid('Invalid Event type list');
  if(a.type!==undefined&&a.types!==undefined)
    invalid('Choose type or types');
  if(a.createdGte!==undefined&&(!Number.isSafeInteger(a.createdGte)||
    a.createdGte<946684800||a.createdGte>4102444800))
    invalid('Invalid Event time boundary');
  const p=paging({limit:a.limit??10,starting_after:a.starting_after});
  if(p.limit>25||(a.starting_after!==undefined&&!eventId(a.starting_after)))
    invalid('Invalid Event paging');
  return {...p,...(a.type?{type:a.type}:{}),...(a.types?{types:a.types}:{}),
    ...(a.createdGte?{created:{gte:a.createdGte}}:{}),
    ...(undelivered?{delivery_success:false}:{})};
}
async function list(a,ctx,undelivered){
  if(ctx?.connection?.mode!=='test')return fail('TEST Event reads only');
  return guarded(ctx,async s=>{
    const params=listParams(a,undelivered);
    const page=await s.events.list(params);
    const projected=pageResult(page,v=>eventSafe(v,{detail:a.detail,select:a.fields}));
    return {...projected,...(undelivered?{
      filter:'Stripe delivery_success=false',
      note:'Provider filtering does not prove an application processed an event.'}:{})};
  });
}
export const tools=[
  {name:'event_list',area:'events',writes:false,profiles:allProfiles,
    description:'List bounded TEST Stripe Event summaries, never embedded customer or payment payloads.',
    annotations:{readOnlyHint:true},
    inputSchema:{type:'object',properties:listSchema,additionalProperties:false}},
  {name:'event_get',area:'events',writes:false,profiles:allProfiles,
    description:'Get an exact TEST Stripe Event type and safe source IDs; no raw event data.',
    annotations:{readOnlyHint:true},
    inputSchema:{type:'object',properties:getSchema,required:['eventId'],additionalProperties:false}},
  {name:'event_list_undelivered',area:'events',writes:false,profiles:allProfiles,
    description:'List TEST Events with Stripe delivery_success=false; not application-processing proof.',
    annotations:{readOnlyHint:true},
    inputSchema:{type:'object',properties:listSchema,additionalProperties:false}}
];
export const handlers={
  event_list:(a,ctx)=>list(a,ctx,false),
  event_list_undelivered:(a,ctx)=>list(a,ctx,true),
  event_get:(a,ctx)=>ctx?.connection?.mode!=='test'?
    fail('TEST Event reads only'):guarded(ctx,async s=>{
      validate(a,Object.keys(getSchema));
      if(!eventId(a.eventId))invalid('Exact Event ID required');
      const v=await s.events.retrieve(a.eventId);
      if(v?.id!==a.eventId)invalid('Stripe Event ID mismatch');
      return eventSafe(v,{detail:a.detail,select:a.fields});
    })
};
