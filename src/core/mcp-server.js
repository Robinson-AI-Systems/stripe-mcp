// Default-deny boundary: only explicitly read-only handlers may run before B's guarded writes.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { requireMcpToken } from './mcp-auth.js';
import { allowBrowserProtocol } from './browser-cors.js';
import { toStripeToolError } from '../tools/errors.js';
import { shapeToolResult } from '../tools/util.js';
import { isToolAllowed, publicToolInfo, listingForConnection, isGuardedTestWrite, isGuardedLiveWrite } from './profiles.js';
import { randomBytes } from 'node:crypto';
import { safePreparsedObject } from './http.js';
import {readDetail,splitResult,resultPage} from '../tools/result-rules.js';
import {nativeReadArgs} from './read-presentation.js';

function inertSnapshot(value){
  const result=safePreparsedObject(value);
  function freeze(node){
    if(node&&typeof node==='object'){
      for(const child of Object.values(node))freeze(child);
      Object.freeze(node);
    }
    return node;
  }
  return freeze(result);
}
export async function dispatchReadOnlyTool({ registry, name, args, connection, db, services={} },depth=0,parent=null) {
  let fixedArgs,fixedConnection,item,handler;
  try{
    if(typeof name!=='string'||!/^[a-z][a-z0-9_]{1,80}$/.test(name)||
      !Number.isInteger(depth)||depth>4||!Array.isArray(registry?.tools)||
      !registry.handlers)throw new TypeError('Unsafe tool invocation');
    fixedArgs=inertSnapshot(args??{});
    fixedConnection=inertSnapshot(connection);
    item=registry.tools.find(t=>
      t&&Object.getOwnPropertyDescriptor(t,'name')?.value===name);
    const slot=Object.getOwnPropertyDescriptor(registry.handlers,name);
    handler=slot&&Object.hasOwn(slot,'value')?slot.value:null;
  }catch{return {isError:true,content:[{type:'text',text:'Tool unavailable for this connection'}]};}
  const guardedWrite=isGuardedTestWrite(item,fixedConnection)||
    isGuardedLiveWrite(item,fixedConnection);
  // A single guarded TEST write may be delegated only through the original
  // stripe_call meta tool. Arbitrary reads/batches and deeper calls cannot.
  const nestedWrite=depth>0&&item?.writes!==false;
  const explicitlyGuarded=nestedWrite&&depth===1&&parent==='stripe_call'&&
    guardedWrite===true&&fixedConnection.mode==='test';
  if(!isToolAllowed(item,fixedConnection.profile,{allowWrites:guardedWrite})||
    nestedWrite&&!explicitlyGuarded){
    return {isError:true,content:[{type:'text',text:'Tool unavailable for this connection'}]};
  }
  if (typeof handler !== 'function') {
    return {isError:true,content:[{type:'text',text:'Tool unavailable'}]};
  }
  try {
    const raw=shapeToolResult(await handler(nativeReadArgs(item,fixedArgs),{connection:fixedConnection,connectionId:fixedConnection.resultScope,db,services,registry,
      liveAccessGranted:fixedConnection?.rtcLiveOwnerApproved===true&&
        fixedConnection?.mode==='live',
      runRead:(toolName,toolArgs)=>dispatchReadOnlyTool({registry,
        name:toolName,args:toolArgs,connection:fixedConnection,db,services},depth+1,name)}),
      {mode:fixedConnection.mode});
    if(raw?.isError)return raw;
    const requested=fixedArgs;
    // Permission re-probe has its own backwards-compatible "compact" detail.
    // Every other read uses the same opt-in dotted field layer.
    const detail=['summary','full'].includes(requested.detail)?requested.detail:undefined;
    let result=raw;
    if(name!=='stripe_get_result'&&Array.isArray(raw?.content)){
      result={...raw,content:raw.content.map(part=>{
        if(part?.type!=='text'||typeof part.text!=='string')return part;
        let value;try {value=JSON.parse(part.text);} catch {return part;}
        return {...part,text:JSON.stringify(readDetail(value,{detail,
          fields:typeof requested.fields==='string'?requested.fields:undefined}))};
      })};
    }
    if(Buffer.byteLength(JSON.stringify(result),'utf8')<=8192)return result;
    // No fallback that silently clips an oversized provider result. Every
    // persisted byte is already redacted by shapeToolResult above.
    if(!fixedConnection.resultScope||typeof db?.putScopedResult!=='function'||
      !Array.isArray(result?.content)||result.content.some(p=>p?.type!=='text')) {
      return {isError:true,content:[{type:'text',text:
        'Result exceeds 8 KB and cannot be securely stored for this connection.'}]};
    }
    const handle='res_'+randomBytes(18).toString('base64url');
    // Save the redacted JSON value, not the MCP transport wrapper, so owner
    // field selectors on stripe_get_result address actual provider fields.
    let safeValue=result;
    if(result.content.length===1&&result.content[0].type==='text') {
      try{safeValue=JSON.parse(result.content[0].text);}catch{/* save shaped wrapper */}
    }
    const body=splitResult(safeValue);
    let records=0;
    try{
      const value=safeValue;
      records=Array.isArray(value)?value.length:
        Array.isArray(value?.data)?value.data.length:
          Array.isArray(value?.accounts)?value.accounts.length:1;
    }catch{records=1;}
    const summary='Saved '+records+' result record(s) from '+name+
      ', '+body.totalBytes+' bytes (TEST connection only)';
    await db.putScopedResult({handle,connection:fixedConnection.resultScope,
      body,summary,expiresAt:new Date(Date.now()+86400000)});
    return {content:[{type:'text',text:JSON.stringify({
      handle,summary,totalBytes:body.totalBytes,records,expiresInHours:24,
      ...resultPage(body,0)
    })}]};
  }
  catch (error) {
    return toStripeToolError(error,{mode:fixedConnection.mode}) ||
      {isError:true,content:[{type:'text',text:'Could not read account details; check server setup'}]};
  }
}
export function createMcpHandler({ db, registry, services={}, env = process.env }) {
  return async function mcp(req, res) {
    // Apply CORS on authenticated success and on 401 challenges alike.
    if (allowBrowserProtocol(req, res, { methods: ['GET','POST','DELETE'], mcp: true })) return;
    const connection = await requireMcpToken(req,res,db,env);
    if (!connection) return;
    const server = new Server({name:'robinson-stripe-mcp',version:'0.1.0'},
      {capabilities:{tools:{}}});
    server.setRequestHandler(ListToolsRequestSchema,async()=>({
      tools:listingForConnection(registry,connection,req.query?.listing).map(publicToolInfo)
    }));
    server.setRequestHandler(CallToolRequestSchema,async request=>
      dispatchReadOnlyTool({registry,name:request.params?.name,args:request.params?.arguments,connection,db,services}));
    const transport = new StreamableHTTPServerTransport({sessionIdGenerator:undefined});
    res.on?.('close',()=>{transport.close();server.close();});
    try {
      await server.connect(transport);
      await transport.handleRequest(req,res,req.body);
    } catch {
      if (!res.headersSent) res.status(500).json({error:'internal_error'});
    }
  };
}
