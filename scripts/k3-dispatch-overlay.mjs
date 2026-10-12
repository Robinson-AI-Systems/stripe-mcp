// Original Stripe MCP transport and handlers stay; only dispatch is tested
// through a checksum-verified private core in disposable CI.
export function overlayDispatch(source){
  const start=source.indexOf('export async function dispatchReadOnlyTool(');
  const end=source.indexOf('export function createMcpHandler(',start);
  if(!source.startsWith('// Default-deny boundary:')||start<0||end<=start||
    !source.includes('safePreparsedObject')||
    !source.includes('Object.getOwnPropertyDescriptor(registry.handlers,name)'))
    throw Error('Original source dispatcher drift');
  const imports="import * as core from 'robinson-mcp-core/mcp-dispatch';\n"+
    "import {createStripeCoreDispatcher} from './k3-dispatch-seams.js';\n";
  const generated=source.slice(0,start)+
    "export async function dispatchReadOnlyTool({registry,name,args,connection,db,services={}}){\n"+
    "  return createStripeCoreDispatcher({core,registry})({name,args,connection,db,services});\n"+
    "}\n"+source.slice(end);
  return generated.replace("import { Server }",imports+"import { Server }");
}
