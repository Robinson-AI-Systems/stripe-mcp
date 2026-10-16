// Immutable Stripe upstream v2556 source. A change to any one of the 23
// vendored parts fails before any universal operation can execute.
import {loadPinnedOpenApi,searchOperations,PINNED_VERSION}
  from '../../scripts/stripe-openapi.mjs';
let cached=null;
const verbs=['get','post','delete','put','patch'];
const simple=/^[A-Za-z0-9_-]{1,180}$/;
const bad=why=>{throw new TypeError(why);};
const safe=s=>typeof s==='string'&&s.length<=1000;
export const apiVersion=PINNED_VERSION;
export function catalog(){
  if(cached)return cached;
  const {spec,sha256}=loadPinnedOpenApi();
  const all=new Map();
  for(const [path,methods] of Object.entries(spec.paths)){
    for(const verb of verbs){
      const def=methods[verb];if(!def)continue;
      const id=def.operationId;
      if(!safe(id)||!id||all.has(id))bad('Pinned operationId is missing or duplicated');
      all.set(id,{id,method:verb.toUpperCase(),path,summary:def.summary??'',
        def,root:spec});
    }
  }
  if(all.size<400)bad('Pinned OpenAPI operation coverage incomplete');
  cached={spec,sha256,operations:all};
  return cached;
}
export function resolveReference(root,definition,depth=0){
  if(depth>12)bad('Recursive upstream parameter reference');
  if(typeof definition?.$ref!=='string')return definition;
  if(!definition.$ref.startsWith('#/'))bad('External upstream reference unsupported');
  const found=definition.$ref.slice(2).split('/').reduce((value,part)=>
    value?.[part.replace(/~1/g,'/').replace(/~0/g,'~')],root);
  if(!found)bad('Unresolved pinned OpenAPI reference');
  return resolveReference(root,found,depth+1);
}
export function getOperation(id,method=null){
  const operation=catalog().operations.get(id);
  if(!operation||(method&&operation.method!==method))
    bad('Unknown or disallowed pinned Stripe operationId');
  return operation;
}
function parameters(record){
  const combined=[...(record.root.paths[record.path].parameters??[]),
    ...(record.def.parameters??[])];
  return combined.map(v=>resolveReference(record.root,v));
}
export function paramNames(record,location){
  return parameters(record).filter(p=>p.in===location).map(p=>({
    name:p.name,required:p.required===true,schema:resolveReference(record.root,p.schema??{})}));
}
export function requestSchema(record){
  const body=resolveReference(record.root,record.def.requestBody??{});
  const content=body?.content??{};
  const kind=content['application/x-www-form-urlencoded']??
    content['application/json']??content['multipart/form-data'];
  return kind?resolveReference(record.root,kind.schema??{}):null;
}
export function describeOperation(id){
  const r=getOperation(id);
  return {operationId:r.id,method:r.method,path:r.path,
    summary:String(r.summary).slice(0,180),version:apiVersion,
    pathParams:paramNames(r,'path').map(p=>({name:p.name,required:p.required})),
    queryParams:paramNames(r,'query').map(p=>({name:p.name,required:p.required})),
    bodyFields:Object.keys(requestSchema(r)?.properties??{}).slice(0,80),
    bodySupported:!!requestSchema(r)};
}
export function findOperations(query,limit=15){
  if(typeof query!=='string'||!query.trim()||query.length>100||
    !Number.isInteger(limit)||limit<1||limit>20)bad('Provide bounded Stripe operation search');
  const {spec}=catalog();
  const results=searchOperations(spec,query,limit);
  return results.map(r=>({operationId:r.operationId,method:r.method,path:r.path,
    summary:r.summary.slice(0,100)}));
}
function validateScalar(value,schema){
  const type=schema?.type;
  if(schema.enum&&!schema.enum.includes(value))bad('Value is outside pinned enum');
  if(type==='string'&&(typeof value!=='string'||value.length>Math.min(schema.maxLength??600,600)))
    bad('Invalid pinned string parameter');
  if(type==='integer'&&(!Number.isSafeInteger(value)||value<(schema.minimum??-1e12)||
    value>(schema.maximum??1e12)))bad('Invalid pinned integer parameter');
  if(type==='number'&&(typeof value!=='number'||!Number.isFinite(value)))
    bad('Invalid pinned numeric parameter');
  if(type==='boolean'&&typeof value!=='boolean')bad('Invalid pinned boolean parameter');
}
export function validateSchema(input,source,{depth=0,root=null}={}){
  if(depth>6)bad('OpenAPI nested parameters too deep');
  const schema=resolveReference(root??catalog().spec,source??{});
  if(input===null){if(schema.nullable||schema.type==='null')return null;bad('Unexpected null parameter');}
  if(Array.isArray(input)){
    if(schema.type!=='array'||input.length>100)bad('Unexpected or oversized array');
    return input.map(x=>validateSchema(x,schema.items??{},{depth:depth+1,root}));
  }
  if(input&&typeof input==='object'){
    if(schema.type&&schema.type!=='object'&&!schema.allOf&&
      !schema.oneOf&&!schema.anyOf)bad('Unexpected nested parameter object');
    if(Object.getPrototypeOf(input)!==Object.prototype)bad('Only plain JSON parameters');
    const combined=schema.allOf?.map(v=>resolveReference(root??catalog().spec,v))??[];
    const props={...schema.properties};
    for(const other of combined)Object.assign(props,other.properties??{});
    const required=new Set([...schema.required??[],...combined.flatMap(x=>x.required??[])]);
    for(const key of required)if(!Object.hasOwn(input,key))bad('Missing pinned required parameter');
    if(Object.keys(input).length>60)bad('Too many nested parameters');
    const out={};
    for(const [key,value] of Object.entries(input)){
      if(!/^[A-Za-z0-9_\-]{1,100}$/.test(key)||['__proto__','constructor','prototype'].includes(key))
        bad('Unsafe nested parameter name');
      const prop=props[key];
      if(!prop)bad('Unknown pinned OpenAPI parameter '+key);
      out[key]=validateSchema(value,prop,{depth:depth+1,root});
    }
    return out;
  }
  validateScalar(input,schema);
  if(typeof input==='string'&&/[\u0000-\u001f]/.test(input))bad('Control characters forbidden');
  return input;
}
export function checkedRequest(id,args){
  const r=getOperation(id);
  if(!args||typeof args!=='object'||Array.isArray(args)||
    Object.keys(args).some(k=>!['pathParams','query','body'].includes(k)))
    bad('Supply only pinned pathParams, query and body');
  const pathFields=paramNames(r,'path'),queryFields=paramNames(r,'query');
  const check=(input,fields)=>{
    const src=input??{};
    if(!src||typeof src!=='object'||Array.isArray(src))bad('Structured parameters required');
    const known=Object.fromEntries(fields.map(x=>[x.name,x]));
    if(Object.keys(src).some(k=>!Object.hasOwn(known,k)))bad('Unknown pinned path or query parameter');
    for(const f of fields)if(f.required&&!Object.hasOwn(src,f.name))
      bad('Missing pinned required '+f.name);
    return Object.fromEntries(Object.entries(src).map(([k,v])=>
      [k,validateSchema(v,known[k].schema,{root:r.root})]));
  };
  const pathArgs=check(args.pathParams,pathFields),query=check(args.query,queryFields);
  const placeholders=[...r.path.matchAll(/\{([^}]+)\}/g)].map(x=>x[1]);
  if(placeholders.some(k=>!simple.test(String(pathArgs[k]??'')))||
    placeholders.some(k=>!Object.hasOwn(pathArgs,k)))
    bad('Exact bounded Stripe path identifier required');
  const path=r.path.replace(/\{([^}]+)\}/g,(_,name)=>encodeURIComponent(pathArgs[name]));
  if(!/^\/v1\/[A-Za-z0-9_./%~-]+$/.test(path)||
    path.includes('//')||path.includes('/../'))bad('Unsafe pinned Stripe resource path');
  const bodySchema=requestSchema(r);
  if(args.body!==undefined&&r.method==='GET')bad('GET cannot submit a body');
  if(args.body!==undefined&&!bodySchema)bad('Upstream operation has no body schema');
  const body=args.body===undefined?{}:validateSchema(args.body,bodySchema,{root:r.root});
  return {record:r,path,query,body};
}
