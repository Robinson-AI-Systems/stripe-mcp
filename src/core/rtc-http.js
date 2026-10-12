// RTC 1-compatible HTTPS read-only TEST slice. Passes never authenticate MCP.
// This public door cannot execute writes, even through meta-tools or batch.
import {incomingBodyWithinLimit,send} from './http.js';
import {dispatchReadOnlyTool} from './mcp-server.js';
import {publicToolInfo} from './profiles.js';

const AUTH=/^Bearer (rtc_pass_[A-Za-z0-9_-]{43})$/;
const READ_ONLY=new Set(['read_only']);
const CODE=new Set(['permission','pass_revoked','pass_expired','rate_limited',
  'invalid_args','not_found','refused_by_guard','outside_scope','service_error']);
const err=(code,status,extra={})=>({status,body:{ok:false,error:{
  code,what:code.replaceAll('_',' '),cause:'Request could not be completed',
  todo:'Check your TEST pass, permitted tool and arguments.',
  technical:''}},headers:extra});
const alias=name=>name.startsWith('stripe_')?name:'stripe_'+name;
// A scoped pass cannot tunnel through meta-dispatchers to a different area.
const DELEGATES=new Set(['stripe_call','stripe_batch','stripe_search_tools',
  'stripe_describe_tool','api_search']);
const INTERNAL=new Set(['stripe_get_result','stripe_whoami']);
const inScope=(t,areas)=>!Array.isArray(areas)||
  ((!DELEGATES.has(t.name))&&
    (areas.includes(t.area??'server')||INTERNAL.has(t.name)));
// Guard and manifest must use the same provider-derived money classification.
 // Stripe's defineWrite adapter declares moneySpec/safety, not a money boolean.
const moneyTool=t=>t?.money===true||t?.moneySpec==='provider-derived'||t?.safety==='
const allowedTool=(registry,name,areas)=>registry.tools.find(t=>
  alias(t.name)===name&&safeRead(t)&&inScope(t,areas))??null;
const metadata=t=>{
  const info=publicToolInfo(t);
  return {name:alias(t.name),description:String(t.description).slice(0,160),
    inputSchema:info.inputSchema,area:t.area??'server',profiles:t.profiles,
    writes:false,money:false,destructive:false,
    audience:t.area==='admin'?['owner']:['builder','owner','operator'],
    annotations:{readOnlyHint:true,destructiveHint:false,
      idempotentHint:true,openWorldHint:true}};
};
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const argsOf=req=>{
  const body=req.body;
  if(!isRecord(body)||!incomingBodyWithinLimit(req))return null;
  return body;
};
function unpack(output){
  if(output?.isError||!Array.isArray(output?.content)||output.content.length!==1||
    typeof output.content[0]?.text!=='string')return null;
  try{return JSON.parse(output.content[0].text);}catch{return null;}
}
export function rtcManifest(registry){
  const names=registry.tools.map(t=>alias(t.name));
  if(new Set(names).size!==names.length)
    throw new Error('RTC prefixed tool aliases must remain unique');
  return {rtc:1,server:'robinson-stripe-mcp',prefix:'stripe',
    version:'0.1.0',areas:[...new Set(registry.tools.map(t=>t.area??'server'))].sort(),
    counts:{tools:names.length,writes:registry.tools.filter(t=>t.writes===true).length,
      money:registry.tools.filter(moneyTool).length},
    profiles:['read_only','everyday','full'],listingModes:['compact','catalog'],
    modes:['test'],devTools:true,
    conformanceStatus:'pending_full_approval_and_provider_acceptance',
    access:'test_read_only_only'};
}
export function rtcOpenApi(){
  return {openapi:'3.1.0',info:{title:'Robinson Stripe MCP RTC TEST reads',version:'0.1.0'},
    paths:{'/api/contract':{get:{summary:'Public RTC manifest'}},
      '/api/whoami':{get:{summary:'Read TEST pass identity'}},
      '/api/tools':{get:{summary:'Search safe tool metadata'}},
      '/api/tools/{name}':{get:{summary:'Describe tool'},post:{summary:'Execute permitted read'}},
      '/api/tools/_batch':{post:{summary:'Execute up to ten read-only tools'}},
      '/api/results/{handle}':{get:{summary:'Read one own scoped result'}}}};
}
export function createRtcReadOnlyHttpHandler({db,registry,services={}}){
  if(!db||!registry?.tools||!registry?.handlers)
    throw new TypeError('RTC handler dependencies required');
  async function call(name,args,connection){
    const t=allowedTool(registry,name,connection.areas);
    if(!t||!isRecord(args))return {error:'refused_by_guard'};
    // RTC clients may supply a field array; the core projection rules still
    // validate the shared comma-separated dotted-field representation.
    let safeArgs=args;
    if(Array.isArray(args.fields)){
      if(args.fields.length<1||args.fields.length>12||
        args.fields.some(f=>typeof f!=='string'||f.length>100)||
        args.fields.join(',').length>600)return {error:'invalid_args'};
      safeArgs={...args,fields:args.fields.join(',')};
    }
    // Reject unexpected pass-provided credentials and dangerous non-read tools;
    // the registered dispatcher remains the final profile/guard authority.
    const output=await dispatchReadOnlyTool({registry,name:t.name,args:safeArgs,connection,db,services});
    const result=unpack(output);
    // An absent or foreign scoped result is a normal not_found, not a server fault.
    // This must not distinguish expired, missing, or other-pass handles.
    if(result===null)return {error:t.name==='stripe_get_result'?
      'not_found':'service_error'};
    const handle=typeof result.handle==='string'&&/^res_[A-Za-z0-9_-]{24,48}$/.test(result.handle)?
      result.handle:undefined;
    return {result,handle};
  }
  return async (req,res,route,name)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const auth=AUTH.exec(String(req.headers?.authorization??''));
    if(!auth){
      res.setHeader('WWW-Authenticate','Bearer realm="RTC TEST pass"');
      return send(res,401,err('permission',401).body);
    }
    let pass;
    try{pass=await db.getRtcPassStatus(auth[1]);}catch{
      return send(res,503,err('service_error',503).body);
    }
    if(!pass||pass.kind!=='pass')return send(res,401,err('permission',401).body);
    if(pass.revoked_at)return send(res,401,err('pass_revoked',401).body);
    if(!pass.expires_at||new Date(pass.expires_at).getTime()<=Date.now())
      return send(res,401,err('pass_expired',401).body);
    if(pass.mode!=='test'||!READ_ONLY.has(pass.profile)||
      pass.allow_writes!==false||Number(pass.money_limit_cents)!==0||
      !Number.isInteger(Number(pass.rate_limit_per_minute))||
      Number(pass.rate_limit_per_minute)<1||Number(pass.rate_limit_per_minute)>600)
      return send(res,403,err('refused_by_guard',403).body);
    try{
      const owner=await db.getStripeAccount(pass.stripe_account);
      if(!owner?.test_connected||owner.live_enabled===true)
        return send(res,403,err('refused_by_guard',403).body);
      const permitted=await db.consumeRtcPassRate({token:auth[1],
        limit:Number(pass.rate_limit_per_minute)});
      if(!permitted){res.setHeader('Retry-After','60');
        return send(res,429,err('rate_limited',429).body);}
    }catch{return send(res,503,err('service_error',503).body);}
    // Fail closed for corrupt area grants; null is the legacy unscoped read-only pass.
    if(pass.areas!=null&&(!Array.isArray(pass.areas)||
      pass.areas.some(a=>typeof a!=='string'||!/^[a-z][a-z_]{0,49}$/.test(a))))
      return send(res,403,err('outside_scope',403).body);
    const connection={clientId:pass.client_id,stripeAccount:pass.stripe_account,
      mode:'test',profile:'read_only',listing:'compact',
      resultScope:pass.result_scope,areas:pass.areas??null};
    const success=(result,handle)=>send(res,200,{
      ok:true,result,...(handle?{handle,mode:'test'}:{mode:'test'})});
    const error=(code,status=400)=>send(res,status,err(CODE.has(code)?code:'service_error',status).body);
    // A provider/storage failure is not a permission refusal. Preserve the
    // machine-readable RTC reason and the matching HTTP status for all doors.
    const callErrorStatus=code=>code==='invalid_args'?400:
      code==='not_found'?404:code==='service_error'?503:403;
    if(route==='whoami'){
      if(req.method!=='GET')return error('invalid_args',405);
      return success({mode:'test',profile:'read_only',listing:connection.listing,
        allowWrites:false,moneyLimitCents:0,areas:pass.areas??[],
        expiresAt:new Date(pass.expires_at).toISOString()});
    }
    if(route==='catalog'){
      if(req.method!=='GET')return error('invalid_args',405);
      const limit=Number(req.query?.limit??20);
      if(!Number.isInteger(limit)||limit<1||limit>100)return error('invalid_args');
      const q=req.query?.q,area=req.query?.area,listing=req.query?.listing;
      const offset=Number(req.query?.offset??0),audience=req.query?.audience;
      if(q!==undefined&&(typeof q!=='string'||q.length>100)||
        area!==undefined&&(typeof area!=='string'||area.length>50)||
        listing!==undefined&&!['compact','catalog'].includes(listing)||
        !Number.isInteger(offset)||offset<0||offset>100000||
        audience!==undefined&&!['owner','operator','builder'].includes(audience))
        return error('invalid_args');
      let tools=registry.tools.filter(t=>safeRead(t)&&inScope(t,connection.areas)&&(!area||t.area===area)&&
        (!q||alias(t.name).includes(q.toLowerCase())||
          t.description?.toLowerCase().includes(q.toLowerCase()))&&
        (!audience||metadata(t).audience.includes(audience)));
      if((listing??'catalog')==='compact')
        tools=tools.filter(t=>['stripe_whoami','stripe_search_tools','stripe_describe_tool',
          'stripe_call','stripe_batch','stripe_get_result'].includes(t.name));
      const list=tools.slice(offset,offset+limit).map(metadata);
      return success({tools:list,total:tools.length,offset,
        next:tools.length>offset+limit?offset+limit:null});
    }
    if(route==='describe'){
      if(req.method!=='GET'||typeof name!=='string')return error('invalid_args');
      const t=allowedTool(registry,name,connection.areas);
      return t?success(metadata(t)):error('not_found',404);
    }
    if(route==='call'){
      if(req.method!=='POST')return error('invalid_args',405);
      const args=argsOf(req);
      if(!args)return error('invalid_args');
      const value=await call(name,args,connection);
      return value.error?error(value.error,callErrorStatus(value.error)):
        success(value.result,value.handle);
    }
    if(route==='batch'){
      if(req.method!=='POST')return error('invalid_args',405);
      const args=argsOf(req);
      if(!Array.isArray(args?.calls)||args.calls.length<1||args.calls.length>10||
        args.calls.some(v=>!isRecord(v)||typeof v.name!=='string'||
          !allowedTool(registry,v.name,connection.areas)||!isRecord(v.args??{})))
        return error('invalid_args');
      const results=[];
      for(const item of args.calls){
        const value=await call(item.name,item.args??{},connection);
        if(value.error)return error(value.error,callErrorStatus(value.error));
        results.push({name:item.name,result:value.result});
      }
      return success({results,count:results.length});
    }
    if(route==='result'){
      if(req.method!=='GET'||typeof name!=='string'||
        !/^res_[A-Za-z0-9_-]{24,48}$/.test(name))return error('invalid_args');
      const page=Number(req.query?.page??0);
      if(!Number.isInteger(page)||page<0||page>100000)return error('invalid_args');
      const value=await call('stripe_get_result',{handle:name,page},connection);
      return value.error?error(value.error,callErrorStatus(value.error)):success(value.result);
    }
    return error('not_found',404);
  };
}
;
const safeRead=t=>t?.writes===false&&!moneyTool(t)&&
  t.destructive!==true&&t.profiles?.includes('read_only');
const allowedTool=(registry,name,areas)=>registry.tools.find(t=>
  alias(t.name)===name&&safeRead(t)&&inScope(t,areas))??null;
const metadata=t=>{
  const info=publicToolInfo(t);
  return {name:alias(t.name),description:String(t.description).slice(0,160),
    inputSchema:info.inputSchema,area:t.area??'server',profiles:t.profiles,
    writes:false,money:false,destructive:false,
    audience:t.area==='admin'?['owner']:['builder','owner','operator'],
    annotations:{readOnlyHint:true,destructiveHint:false,
      idempotentHint:true,openWorldHint:true}};
};
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const argsOf=req=>{
  const body=req.body;
  if(!isRecord(body)||!incomingBodyWithinLimit(req))return null;
  return body;
};
function unpack(output){
  if(output?.isError||!Array.isArray(output?.content)||output.content.length!==1||
    typeof output.content[0]?.text!=='string')return null;
  try{return JSON.parse(output.content[0].text);}catch{return null;}
}
export function rtcManifest(registry){
  const names=registry.tools.map(t=>alias(t.name));
  if(new Set(names).size!==names.length)
    throw new Error('RTC prefixed tool aliases must remain unique');
  return {rtc:1,server:'robinson-stripe-mcp',prefix:'stripe',
    version:'0.1.0',areas:[...new Set(registry.tools.map(t=>t.area??'server'))].sort(),
    counts:{tools:names.length,writes:registry.tools.filter(t=>t.writes===true).length,
      money:registry.tools.filter(t=>t.money===true).length},
    profiles:['read_only','everyday','full'],listingModes:['compact','catalog'],
    modes:['test'],devTools:true,
    conformanceStatus:'pending_full_approval_and_provider_acceptance',
    access:'test_read_only_only'};
}
export function rtcOpenApi(){
  return {openapi:'3.1.0',info:{title:'Robinson Stripe MCP RTC TEST reads',version:'0.1.0'},
    paths:{'/api/contract':{get:{summary:'Public RTC manifest'}},
      '/api/whoami':{get:{summary:'Read TEST pass identity'}},
      '/api/tools':{get:{summary:'Search safe tool metadata'}},
      '/api/tools/{name}':{get:{summary:'Describe tool'},post:{summary:'Execute permitted read'}},
      '/api/tools/_batch':{post:{summary:'Execute up to ten read-only tools'}},
      '/api/results/{handle}':{get:{summary:'Read one own scoped result'}}}};
}
export function createRtcReadOnlyHttpHandler({db,registry,services={}}){
  if(!db||!registry?.tools||!registry?.handlers)
    throw new TypeError('RTC handler dependencies required');
  async function call(name,args,connection){
    const t=allowedTool(registry,name,connection.areas);
    if(!t||!isRecord(args))return {error:'refused_by_guard'};
    // RTC clients may supply a field array; the core projection rules still
    // validate the shared comma-separated dotted-field representation.
    let safeArgs=args;
    if(Array.isArray(args.fields)){
      if(args.fields.length<1||args.fields.length>12||
        args.fields.some(f=>typeof f!=='string'||f.length>100)||
        args.fields.join(',').length>600)return {error:'invalid_args'};
      safeArgs={...args,fields:args.fields.join(',')};
    }
    // Reject unexpected pass-provided credentials and dangerous non-read tools;
    // the registered dispatcher remains the final profile/guard authority.
    const output=await dispatchReadOnlyTool({registry,name:t.name,args:safeArgs,connection,db,services});
    const result=unpack(output);
    // An absent or foreign scoped result is a normal not_found, not a server fault.
    // This must not distinguish expired, missing, or other-pass handles.
    if(result===null)return {error:t.name==='stripe_get_result'?
      'not_found':'service_error'};
    const handle=typeof result.handle==='string'&&/^res_[A-Za-z0-9_-]{24,48}$/.test(result.handle)?
      result.handle:undefined;
    return {result,handle};
  }
  return async (req,res,route,name)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    const auth=AUTH.exec(String(req.headers?.authorization??''));
    if(!auth){
      res.setHeader('WWW-Authenticate','Bearer realm="RTC TEST pass"');
      return send(res,401,err('permission',401).body);
    }
    let pass;
    try{pass=await db.getRtcPassStatus(auth[1]);}catch{
      return send(res,503,err('service_error',503).body);
    }
    if(!pass||pass.kind!=='pass')return send(res,401,err('permission',401).body);
    if(pass.revoked_at)return send(res,401,err('pass_revoked',401).body);
    if(!pass.expires_at||new Date(pass.expires_at).getTime()<=Date.now())
      return send(res,401,err('pass_expired',401).body);
    if(pass.mode!=='test'||!READ_ONLY.has(pass.profile)||
      pass.allow_writes!==false||Number(pass.money_limit_cents)!==0||
      !Number.isInteger(Number(pass.rate_limit_per_minute))||
      Number(pass.rate_limit_per_minute)<1||Number(pass.rate_limit_per_minute)>600)
      return send(res,403,err('refused_by_guard',403).body);
    try{
      const owner=await db.getStripeAccount(pass.stripe_account);
      if(!owner?.test_connected||owner.live_enabled===true)
        return send(res,403,err('refused_by_guard',403).body);
      const permitted=await db.consumeRtcPassRate({token:auth[1],
        limit:Number(pass.rate_limit_per_minute)});
      if(!permitted){res.setHeader('Retry-After','60');
        return send(res,429,err('rate_limited',429).body);}
    }catch{return send(res,503,err('service_error',503).body);}
    // Fail closed for corrupt area grants; null is the legacy unscoped read-only pass.
    if(pass.areas!=null&&(!Array.isArray(pass.areas)||
      pass.areas.some(a=>typeof a!=='string'||!/^[a-z][a-z_]{0,49}$/.test(a))))
      return send(res,403,err('outside_scope',403).body);
    const connection={clientId:pass.client_id,stripeAccount:pass.stripe_account,
      mode:'test',profile:'read_only',listing:'compact',
      resultScope:pass.result_scope,areas:pass.areas??null};
    const success=(result,handle)=>send(res,200,{
      ok:true,result,...(handle?{handle,mode:'test'}:{mode:'test'})});
    const error=(code,status=400)=>send(res,status,err(CODE.has(code)?code:'service_error',status).body);
    // A provider/storage failure is not a permission refusal. Preserve the
    // machine-readable RTC reason and the matching HTTP status for all doors.
    const callErrorStatus=code=>code==='invalid_args'?400:
      code==='not_found'?404:code==='service_error'?503:403;
    if(route==='whoami'){
      if(req.method!=='GET')return error('invalid_args',405);
      return success({mode:'test',profile:'read_only',listing:connection.listing,
        allowWrites:false,moneyLimitCents:0,areas:pass.areas??[],
        expiresAt:new Date(pass.expires_at).toISOString()});
    }
    if(route==='catalog'){
      if(req.method!=='GET')return error('invalid_args',405);
      const limit=Number(req.query?.limit??20);
      if(!Number.isInteger(limit)||limit<1||limit>100)return error('invalid_args');
      const q=req.query?.q,area=req.query?.area,listing=req.query?.listing;
      const offset=Number(req.query?.offset??0),audience=req.query?.audience;
      if(q!==undefined&&(typeof q!=='string'||q.length>100)||
        area!==undefined&&(typeof area!=='string'||area.length>50)||
        listing!==undefined&&!['compact','catalog'].includes(listing)||
        !Number.isInteger(offset)||offset<0||offset>100000||
        audience!==undefined&&!['owner','operator','builder'].includes(audience))
        return error('invalid_args');
      let tools=registry.tools.filter(t=>safeRead(t)&&inScope(t,connection.areas)&&(!area||t.area===area)&&
        (!q||alias(t.name).includes(q.toLowerCase())||
          t.description?.toLowerCase().includes(q.toLowerCase()))&&
        (!audience||metadata(t).audience.includes(audience)));
      if((listing??'catalog')==='compact')
        tools=tools.filter(t=>['stripe_whoami','stripe_search_tools','stripe_describe_tool',
          'stripe_call','stripe_batch','stripe_get_result'].includes(t.name));
      const list=tools.slice(offset,offset+limit).map(metadata);
      return success({tools:list,total:tools.length,offset,
        next:tools.length>offset+limit?offset+limit:null});
    }
    if(route==='describe'){
      if(req.method!=='GET'||typeof name!=='string')return error('invalid_args');
      const t=allowedTool(registry,name,connection.areas);
      return t?success(metadata(t)):error('not_found',404);
    }
    if(route==='call'){
      if(req.method!=='POST')return error('invalid_args',405);
      const args=argsOf(req);
      if(!args)return error('invalid_args');
      const value=await call(name,args,connection);
      return value.error?error(value.error,callErrorStatus(value.error)):
        success(value.result,value.handle);
    }
    if(route==='batch'){
      if(req.method!=='POST')return error('invalid_args',405);
      const args=argsOf(req);
      if(!Array.isArray(args?.calls)||args.calls.length<1||args.calls.length>10||
        args.calls.some(v=>!isRecord(v)||typeof v.name!=='string'||
          !allowedTool(registry,v.name,connection.areas)||!isRecord(v.args??{})))
        return error('invalid_args');
      const results=[];
      for(const item of args.calls){
        const value=await call(item.name,item.args??{},connection);
        if(value.error)return error(value.error,callErrorStatus(value.error));
        results.push({name:item.name,result:value.result});
      }
      return success({results,count:results.length});
    }
    if(route==='result'){
      if(req.method!=='GET'||typeof name!=='string'||
        !/^res_[A-Za-z0-9_-]{24,48}$/.test(name))return error('invalid_args');
      const page=Number(req.query?.page??0);
      if(!Number.isInteger(page)||page<0||page>100000)return error('invalid_args');
      const value=await call('stripe_get_result',{handle:name,page},connection);
      return value.error?error(value.error,callErrorStatus(value.error)):success(value.result);
    }
    return error('not_found',404);
  };
}
