// RTC 1 HTTPS pass door: owner-scoped TEST reads and explicitly guarded writes.
// Passes never authenticate MCP, batch stays strictly read-only, and all
// provider money movement still needs its native independent owner gate.
import {incomingBodyWithinLimit,safePreparsedObject,send} from './http.js';
import {dispatchReadOnlyTool} from './mcp-server.js';
import {publicToolInfo,isGuardedTestWrite} from './profiles.js';
import {projectFields} from '../tools/result-rules.js';

// HTTP authentication scheme tokens are case-insensitive; pass bytes are not.
const AUTH=/^[Bb][Ee][Aa][Rr][Ee][Rr][ \t]+(rtc_pass_[A-Za-z0-9_-]{43})$/;
const PASS_PROFILES=new Set(['read_only','everyday','full']);
const CODE=new Set(['permission','pass_revoked','pass_expired','rate_limited',
  'invalid_args','not_found','refused_by_guard','outside_scope','service_error']);
const err=(code,status,extra={})=>({status,body:{ok:false,error:{
  code,what:code.replaceAll('_',' '),cause:'Request could not be completed',
  todo:'Check your TEST pass, permitted tool and arguments.',
  technical:''}},headers:extra});
const alias=name=>name.startsWith('stripe_')?name:'stripe_'+name;
// All HTTPS TEST passes, including legacy unscoped rows, must use direct
// RTC discovery/call/batch doors. MCP meta-dispatch stays MCP-only.
const DELEGATES=new Set(['stripe_call','stripe_batch','stripe_search_tools',
  'stripe_describe_tool','api_search']);
const INTERNAL=new Set(['stripe_get_result','stripe_whoami']);
const inScope=(t,areas)=>!DELEGATES.has(t.name)&&
  (!Array.isArray(areas)||
    areas.includes(t.area??'server')||INTERNAL.has(t.name));
// Guard and manifest must share the provider-derived money classification.
// Stripe guarded writes expose moneySpec/safety instead of a money boolean.
const moneyTool=t=>t?.money===true||t?.moneySpec==='provider-derived'||
  t?.safety===String.fromCharCode(36);
const safeRead=t=>t?.writes===false&&!moneyTool(t)&&
  t.destructive!==true&&t.profiles?.includes('read_only');
const allowedTool=(registry,name,connection)=>registry.tools.find(t=>{
  if(alias(t.name)!==name||!inScope(t,connection?.areas)||
    !t.profiles?.includes(connection?.profile))return false;
  if(t.writes===false)return !moneyTool(t)&&t.destructive!==true;
  // Money writers require both an owner-selected positive delegated ceiling
  // and the original native per-request owner approval + atomic account ledger.
  // Passing the ceiling never approves a payment or bypasses those guards.
  if(moneyTool(t)&&(!Number.isSafeInteger(connection?.moneyLimitCents)||
    connection.moneyLimitCents<=0))return false;
  return connection?.allowWrites===true&&
    isGuardedTestWrite(t,connection);
})??null;
const metadata=(t,connection)=>{
  const info=publicToolInfo(t);
  // HTTP supports both standard dotted strings and RTC array selectors.
  // Leave the MCP registry schema unchanged for existing connector clients.
  const inputSchema=t.writes===true?info.inputSchema:
    {...info.inputSchema,properties:{
    ...info.inputSchema.properties,
    fields:{description:'Up to 12 safe dotted fields, as string or array',
      oneOf:[{type:'string',maxLength:600},
        // A native field selector is an array with its own enums/limits.
        // Preserve that schema rather than advertising arbitrary fields.
        t.inputSchema?.properties?.fields?.type==='array'?
          t.inputSchema.properties.fields:
          {type:'array',minItems:1,maxItems:12,uniqueItems:true,
            items:{type:'string',minLength:1,maxLength:100}}]}}};
  const warning=moneyTool(t)&&!String(t.description).startsWith('MOVES MONEY:')?
    'MOVES MONEY: ':'';
  return {name:alias(t.name),description:(warning+String(t.description)).slice(0,160),
    inputSchema,area:t.area??'server',profiles:[connection?.profile??'read_only'],
    writes:t.writes===true,money:moneyTool(t),destructive:t.destructive===true,
    audience:t.area==='admin'?['owner']:['builder','owner','operator'],
    annotations:{readOnlyHint:t.writes===false,
      destructiveHint:t.destructive===true,
      idempotentHint:t.writes===false,openWorldHint:true}};
};
const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
// Never let JS Number coercion turn null, arrays, hex, exponent or empty
// HTTP pagination selectors into valid provider/result reads.
function boundedPage(value,defaultValue,min,max){
  if(value===undefined)return defaultValue;
  if(typeof value==='number')return Number.isSafeInteger(value)&&
    value>=min&&value<=max?value:null;
  if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value))return null;
  const parsed=Number(value);
  return Number.isSafeInteger(parsed)&&parsed>=min&&parsed<=max?parsed:null;
}
const argsOf=req=>{
  const body=req.body;
  if(!isRecord(body)||!incomingBodyWithinLimit(req))return null;
  return body;
};
// Normalize the same read arguments before either direct dispatch or batch
// preflight. Invalid later batch entries must not cause earlier Stripe reads.
function normalizeReadArgs(args,tool){
  if(!isRecord(args))return null;
  if(tool?.writes===true)return args; // Native guarded writer owns its exact schema.
  const definedDetail=tool?.inputSchema?.properties?.detail;
  const acceptedDetail=Array.isArray(definedDetail?.enum)?
    definedDetail.enum:['summary','full'];
  if(args.detail!==undefined&&!acceptedDetail.includes(args.detail))return null;
  if(args.fields===undefined)return args;
  const fields=Array.isArray(args.fields)?args.fields:
    typeof args.fields==='string'?args.fields.split(',').map(s=>s.trim()):null;
  if(!fields||fields.length<1||fields.length>12||
    fields.some(f=>typeof f!=='string'||f.length>100)||
    fields.join(',').length>600)return null;
  try{projectFields({},fields.join(','));}catch{return null;}
  const native=tool?.inputSchema?.properties?.fields;
  if(native?.type==='array'){
    if(native.maxItems!==undefined&&fields.length>native.maxItems||
      native.minItems!==undefined&&fields.length<native.minItems||
      Array.isArray(native.items?.enum)&&
        fields.some(f=>!native.items.enum.includes(f)))return null;
    // Native G-5a/owner reader validates these exact provider-safe names.
    return {...args,fields};
  }
  // Generic read tools use the shared dotted projection string layer.
  return {...args,fields:fields.join(',')};
}
function unpack(output){
  if(output?.isError||!Array.isArray(output?.content)||output.content.length!==1||
    typeof output.content[0]?.text!=='string')return null;
  try{return JSON.parse(output.content[0].text);}catch{return null;}
}
export function rtcManifest(registry,deployment={}){
  const names=registry.tools.map(t=>alias(t.name));
  if(new Set(names).size!==names.length)
    throw new Error('RTC prefixed tool aliases must remain unique');
  // Public capabilities reflect the union of explicitly eligible pass grants.
  // An actual issued pass sees only its own selected profile, areas and policy.
  const exposed=registry.tools.filter(t=>inScope(t,null)&&(
    safeRead(t)||isGuardedTestWrite(t,{mode:'test',profile:'full'})));
  // Public build provenance is non-secret. Never invent a revision from
  // the running main branch, request Host, or an unverified CI assertion.
  // Missing Vercel system metadata is explicit absence, not a guessed SHA.
  const sha=typeof deployment.sha==='string'&&
    /^[a-f0-9]{40}$/.test(deployment.sha)?deployment.sha:null;
  const ref=typeof deployment.ref==='string'&&
    /^[a-zA-Z0-9_.-]{1,80}$/.test(deployment.ref)?deployment.ref:null;
  const environment=['production','preview','development'].includes(
    deployment.environment)?deployment.environment:null;
  return {rtc:1,server:'robinson-stripe-mcp',prefix:'stripe',
    version:'0.1.0',areas:[...new Set(exposed.map(t=>t.area??'server'))].sort(),
    counts:{tools:exposed.length,writes:exposed.filter(t=>t.writes===true).length,
      money:exposed.filter(moneyTool).length},
    profiles:['read_only','everyday','full'],listingModes:['compact','catalog'],
    modes:['test'],devTools:true,
    conformanceStatus:'pending_external_approval_and_conformance',
    access:'owner_scoped_TEST_passes',
    ...(sha&&ref&&environment?{deployment:{sha,ref,environment}}:{})};
}
export function rtcOpenApi(){
  const json={content:{'application/json':{schema:{type:'object'}}}};
  const success={200:{description:'Successful JSON response',...json}};
  const readBody={required:true,content:{'application/json':{
    schema:{type:'object'}}}};
  const batchBody={required:true,content:{'application/json':{
    schema:{type:'object',required:['calls'],additionalProperties:false,
      properties:{calls:{type:'array',minItems:1,maxItems:10,
        items:{type:'object',required:['name'],properties:{
          name:{type:'string'},args:{type:'object'}}}}}}}}};
  const pathParam=name=>[{name,in:'path',required:true,schema:{type:'string'}}];
  return {openapi:'3.1.0',
    info:{title:'Robinson Stripe MCP RTC scoped TEST API',version:'0.1.0'},
    // OpenAPI describes only the pass-authenticated HTTPS subset. OAuth/MCP
    // has separate authorization, including profiles this door must refuse.
    security:[{rtcTestPass:[]}],
    components:{securitySchemes:{rtcTestPass:{type:'http',scheme:'bearer',
      bearerFormat:'RTC owner-issued TEST pass'}}},
    paths:{
      '/api/contract':{get:{summary:'Public RTC TEST-only manifest',
        security:[],responses:success}},
      '/api/openapi.json':{get:{summary:'Public HTTPS read-only OpenAPI',
        security:[],responses:success}},
      '/api/whoami':{get:{summary:'Read TEST pass identity',responses:success}},
      '/api/tools':{get:{summary:'Search accessible TEST read metadata',
        parameters:[
          {name:'q',in:'query',schema:{type:'string',maxLength:100}},
          {name:'area',in:'query',schema:{type:'string',maxLength:50}},
          {name:'listing',in:'query',schema:{type:'string',enum:['compact','catalog']}},
          {name:'limit',in:'query',schema:{type:'integer',minimum:1,maximum:100}},
          {name:'offset',in:'query',schema:{type:'integer',minimum:0,maximum:100000}},
          {name:'page',in:'query',schema:{type:'integer',minimum:1,maximum:1000}},
          {name:'audience',in:'query',schema:{type:'string',
            enum:['owner','operator','builder']}}],
        responses:success}},
      '/api/tools/{name}':{
        get:{summary:'Describe permitted scoped tool',parameters:pathParam('name'),
          responses:success},
        post:{summary:'Execute permitted TEST tool with original approval',parameters:pathParam('name'),
          requestBody:readBody,responses:success}},
      '/api/tools/_batch':{post:{summary:'Execute up to ten TEST reads',
        requestBody:batchBody,responses:success}},
      '/api/results/{handle}':{get:{summary:'Read own scoped result',
        parameters:[...pathParam('handle'),
          {name:'page',in:'query',schema:{type:'integer',minimum:1,maximum:100000}}],
        responses:success}}
    }};
}
export function createRtcReadOnlyHttpHandler({db,registry,services={}}){
  if(!db||!registry?.tools||!registry?.handlers)
    throw new TypeError('RTC handler dependencies required');
  async function call(name,args,connection){
    const t=allowedTool(registry,name,connection);
    // Absent tools are 404, but existing tools denied by TEST pass profile,
    // area, financial classification or write guard remain 403. Do not
    // conflate an unknown route with an intentionally forbidden operation.
    if(!t)return {error:registry.tools.some(item=>alias(item.name)===name)?
      'refused_by_guard':'not_found'};
    if(!isRecord(args))return {error:'invalid_args'};
    const safeArgs=normalizeReadArgs(args,t);
    if(safeArgs===null)return {error:'invalid_args'};
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
    // Reject and detach framework-parsed bodies before DB rate accounting,
    // handler arguments, or any nested property read. Inert JSON only.
    if (req.method === 'POST') {
      if (!incomingBodyWithinLimit(req))
        return send(res,400,err('invalid_args',400).body);
      let inert;
      try { inert = safePreparsedObject(req.body); }
      catch { return send(res,400,err('invalid_args',400).body); }
      req = {...req,body:inert};
    }
    let pass;
    try{pass=await db.getRtcPassStatus(auth[1]);}catch{
      return send(res,503,err('service_error',503).body);
    }
    const denied=(code)=>{
      res.setHeader('WWW-Authenticate',
        'Bearer realm="RTC TEST pass", error="invalid_token"');
      return send(res,401,err(code,401).body);
    };
    if(!pass||pass.kind!=='pass')return denied('permission');
    if(pass.revoked_at)return denied('pass_revoked');
    // Invalid/far-future dates must not become immortal TEST passes.
    // Every pass is owner-issued; the independent Hub-only flag may grant
    // up to 365 days. Other passes are at most 30 days.
    const expiry=new Date(pass.expires_at??'invalid').getTime();
    const maxLife=(pass.for_hub===true?365:30)*86_400_000+60_000;
    if(!Number.isFinite(expiry)||expiry<=Date.now()||
      expiry>Date.now()+maxLife)
      return denied('pass_expired');
    // Reject corrupt identities/scopes before touching any TEST provider.
    if(typeof pass.client_id!=='string'||
      !/^rtc-agent-[a-z0-9-]{8,80}$/.test(pass.client_id)||
      typeof pass.stripe_account!=='string'||
      !/^acct_[A-Za-z0-9]{2,100}$/.test(pass.stripe_account)||
      typeof pass.result_scope!=='string'||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(pass.result_scope))
      return send(res,403,err('refused_by_guard',403).body);
    // Never coerce null/false/string claims into financial and rate limits.
    // PostgreSQL INTEGER/BOOLEAN columns return native numbers/booleans.
    if(pass.mode!=='test'||!PASS_PROFILES.has(pass.profile)||
      typeof pass.allow_writes!=='boolean'||
      pass.allow_writes&&pass.profile==='read_only'||
      !Number.isSafeInteger(pass.money_limit_cents)||
      pass.money_limit_cents<0||
      pass.money_limit_cents>0&&!pass.allow_writes||
      !Number.isInteger(pass.rate_limit_per_minute)||
      pass.rate_limit_per_minute<1||pass.rate_limit_per_minute>600)
      return send(res,403,err('refused_by_guard',403).body);
    try{
      const owner=await db.getStripeAccount(pass.stripe_account);
      if(!owner?.test_connected)
        return send(res,403,err('refused_by_guard',403).body);
      // Reserve each TEST request or every batch read atomically before dispatch.
      const calls=route==='batch'&&req.method==='POST'?req.body?.calls:null;
      const units=Array.isArray(calls)&&calls.length>=1&&calls.length<=10?
        calls.length:1;
      const permitted=await db.consumeRtcPassRate({token:auth[1],
        limit:pass.rate_limit_per_minute,units});
      if(!permitted){res.setHeader('Retry-After','60');
        return send(res,429,err('rate_limited',429).body);}
    }catch{return send(res,503,err('service_error',503).body);}
    // Fail closed for corrupt area grants; null is the legacy unscoped read-only pass.
    if(pass.areas!=null&&(!Array.isArray(pass.areas)||
      pass.areas.some(a=>typeof a!=='string'||!/^[a-z][a-z_]{0,49}$/.test(a))))
      return send(res,403,err('outside_scope',403).body);
    const connection={clientId:pass.client_id,stripeAccount:pass.stripe_account,
      mode:'test',profile:pass.profile,listing:'compact',
      allowWrites:pass.allow_writes,moneyLimitCents:pass.money_limit_cents,
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
      return success({account:pass.stripe_account,mode:'test',profile:pass.profile,
        listing:connection.listing,allowWrites:pass.allow_writes,
        moneyLimitCents:pass.money_limit_cents,
        rateLimitPerMinute:pass.rate_limit_per_minute,
        areas:pass.areas??null,
        legacyUnscoped:pass.areas==null,
        expiresAt:new Date(pass.expires_at).toISOString()});
    }
    if(route==='catalog'){
      if(req.method!=='GET')return error('invalid_args',405);
      const limit=boundedPage(req.query?.limit,20,1,100);
      const numbered=req.query?.page!==undefined;
      const page=numbered?boundedPage(req.query.page,1,1,1000):null;
      if(numbered&&req.query?.offset!==undefined)return error('invalid_args');
      const offset=numbered&&page!==null?(page-1)*limit:
        boundedPage(req.query?.offset,0,0,100000);
      if(limit===null||offset===null||(numbered&&page===null))
        return error('invalid_args');
      const q=req.query?.q,area=req.query?.area,listing=req.query?.listing;
      const audience=req.query?.audience;
      if(q!==undefined&&(typeof q!=='string'||q.length>100)||
        area!==undefined&&(typeof area!=='string'||area.length>50)||
        listing!==undefined&&!['compact','catalog'].includes(listing)||
        audience!==undefined&&!['owner','operator','builder'].includes(audience))
        return error('invalid_args');
      const needle=q?.toLowerCase();
      let tools=registry.tools.filter(t=>allowedTool(registry,alias(t.name),connection)&&
        (!area||t.area===area)&&
        (!needle||alias(t.name).includes(needle)||
          t.description?.toLowerCase().includes(needle))&&
        (!audience||metadata(t,connection).audience.includes(audience)));
      if((listing??'catalog')==='compact')
        tools=tools.filter(t=>['stripe_whoami','stripe_search_tools','stripe_describe_tool',
          'stripe_call','stripe_batch','stripe_get_result'].includes(t.name));
      const list=tools.slice(offset,offset+limit).map(t=>metadata(t,connection));
      return success({tools:list,total:tools.length,offset,
        // RTC 1 continuation uses 1-based string pages. Preserve the original
        // numeric offset-only API for existing legacy callers.
        next:tools.length>offset+limit?
          numbered?String(page+1):offset+limit:null});
    }
    if(route==='describe'){
      if(req.method!=='GET'||typeof name!=='string')return error('invalid_args');
      const t=allowedTool(registry,name,connection);
      return t?success(metadata(t,connection)):error('not_found',404);
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
          !allowedTool(registry,v.name,connection)||
        allowedTool(registry,v.name,connection)?.writes!==false||
          normalizeReadArgs(v.args??{},allowedTool(registry,v.name,
            connection))===null))
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
      const page=boundedPage(req.query?.page,1,1,100000);
      if(page===null)return error('invalid_args');
      // Public RTC 1 has 1-based contiguous bounded result pages; the
      // original MCP stripe_get_result remains its own 0-based interface.
      // Both paths are scoped to the same authenticated token-owned UUID.
      const stored=await db.getScopedResult({
        handle:name,connection:connection.resultScope});
      if(!stored)return error('not_found',404);
      const value=await call('stripe_get_result',{handle:name,page:page-1},connection);
      if(value.error)return error(value.error,callErrorStatus(value.error));
      const body=stored.body;
      if(!Array.isArray(body?.pages)||body.pages.length<page||
         !body.pages.every(piece=>typeof piece==='string'))
        return error('not_found',404);
      const bytes=body.totalBytes;
      if(!Number.isSafeInteger(bytes)||bytes<0||
        bytes!==Buffer.byteLength(body.pages.join(''),'utf8'))
        return error('service_error',503);
      return success({page,pages:body.pages.length,bytes,
        content:body.pages[page-1],
        next:page<body.pages.length?page+1:null});
    }
    return error('not_found',404);
  };
}