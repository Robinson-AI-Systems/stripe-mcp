// Default-deny boundary: only explicitly read-only handlers may run before B's guarded writes.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { requireMcpToken } from './mcp-auth.js';
import { toStripeToolError } from '../tools/errors.js';
import { shapeToolResult } from '../tools/util.js';
import { isToolAllowed, visibleTools, publicToolInfo } from './profiles.js';
import { randomBytes } from 'node:crypto';
import { readDetail,splitResult,resultPage } from '../tools/result-rules.js';

export async function dispatchReadOnlyTool({ registry, name, args, connection, db, services={} }) {
  const item = registry.tools.find(t => t.name === name);
  if (!isToolAllowed(item,connection?.profile)) {
    return {isError:true,content:[{type:'text',text:'Tool unavailable for this connection'}]};
  }
  const handler = registry.handlers[name];
  if (typeof handler !== 'function') {
    return {isError:true,content:[{type:'text',text:'Tool unavailable'}]};
  }
  try {
    const raw=shapeToolResult(await handler(args || {},{connection,db,services}),
      {mode:connection.mode});
    if(raw?.isError)return raw;
    const requested=args||{};
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
    if(!connection?.resultScope||typeof db?.putScopedResult!=='function'||
      !Array.isArray(result?.content)||result.content.some(p=>p?.type!=='text')) {
      return {isError:true,content:[{type:'text',text:
        'Result exceeds 8 KB and cannot be securely stored for this connection.'}]};
    }
    const handle='res_'+randomBytes(18).toString('base64url');
    const body=splitResult(result);
    let records=0;
    try{
      const value=JSON.parse(result.content[0]?.text||'null');
      records=Array.isArray(value)?value.length:
        Array.isArray(value?.data)?value.data.length:
          Array.isArray(value?.accounts)?value.accounts.length:1;
    }catch{records=1;}
    const summary='Saved '+records+' result record(s) from '+name+
      ', '+body.totalBytes+' bytes (TEST connection only)';
    await db.putScopedResult({handle,connection:connection.resultScope,
      body,summary,expiresAt:new Date(Date.now()+86400000)});
    return {content:[{type:'text',text:JSON.stringify({
      handle,summary,totalBytes:body.totalBytes,records,expiresInHours:24,
      ...resultPage(body,0)
    })}]};
  }
  catch (error) {
    return toStripeToolError(error,{mode:connection.mode}) ||
      {isError:true,content:[{type:'text',text:'Could not read account details; check server setup'}]};
  }
}
export function createMcpHandler({ db, registry, services={}, env = process.env }) {
  return async function mcp(req, res) {
    const connection = await requireMcpToken(req,res,db,env);
    if (!connection) return;
    const server = new Server({name:'robinson-stripe-mcp',version:'0.1.0'},
      {capabilities:{tools:{}}});
    server.setRequestHandler(ListToolsRequestSchema,async()=>({
      tools:visibleTools(registry,connection.profile).map(publicToolInfo)
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
