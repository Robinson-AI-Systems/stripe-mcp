// Default-deny boundary: only explicitly read-only handlers may run before B's guarded writes.
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { requireMcpToken } from './mcp-auth.js';
import { toStripeToolError } from '../tools/errors.js';
import { shapeToolResult } from '../tools/util.js';
import { isToolAllowed, visibleTools, publicToolInfo } from './profiles.js';

export async function dispatchReadOnlyTool({ registry, name, args, connection, db, permissionProbe=null }) {
  const item = registry.tools.find(t => t.name === name);
  if (!isToolAllowed(item,connection?.profile)) {
    return {isError:true,content:[{type:'text',text:'Tool unavailable for this connection'}]};
  }
  const handler = registry.handlers[name];
  if (typeof handler !== 'function') {
    return {isError:true,content:[{type:'text',text:'Tool unavailable'}]};
  }
  try {
    const result=shapeToolResult(await handler(args || {},{connection,db,permissionProbe}), {mode:connection.mode});
    if (Buffer.byteLength(JSON.stringify(result),'utf8')>8192) {
      return {isError:true,content:[{type:'text',text:
        'Result exceeds 8 KB; narrow the fields or page size. Nothing was silently truncated.'}]};
    }
    return result;
  }
  catch (error) {
    return toStripeToolError(error,{mode:connection.mode}) ||
      {isError:true,content:[{type:'text',text:'Could not read account details; check server setup'}]};
  }
}
export function createMcpHandler({ db, registry, permissionProbe=null, env = process.env }) {
  return async function mcp(req, res) {
    const connection = await requireMcpToken(req,res,db,env);
    if (!connection) return;
    const server = new Server({name:'robinson-stripe-mcp',version:'0.1.0'},
      {capabilities:{tools:{}}});
    server.setRequestHandler(ListToolsRequestSchema,async()=>({
      tools:visibleTools(registry,connection.profile).map(publicToolInfo)
    }));
    server.setRequestHandler(CallToolRequestSchema,async request=>
      dispatchReadOnlyTool({registry,name:request.params?.name,args:request.params?.arguments,connection,db,permissionProbe}));
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
