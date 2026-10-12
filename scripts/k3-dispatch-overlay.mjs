// K-3 private-only, reversible original SDK dispatch adapter.
export function overlayDispatch(source){
  const begin=source.indexOf('export async function dispatchReadOnlyTool(');
  const end=source.indexOf('export function createMcpHandler(',begin);
  if(!source.startsWith('// Default-deny boundary:')||begin<0||end<=begin||
    !source.includes('safePreparsedObject')||
    !source.includes('Object.getOwnPropertyDescriptor(registry.handlers,name)'))
    throw Error('Original source guarded dispatch drift');
  const imports="import * as core from 'robinson-mcp-core/mcp-dispatch';\n"+
    "import {createStripeCoreDispatcher} from './k3-dispatch-seams.js';\n"+
    "import {dispatchReadOnlyTool as originalDispatch} from './k3-mcp-original-private.js';\n";
  const output=source.slice(0,begin)+
    "export async function dispatchReadOnlyTool({registry,name,args,connection,db,services={}}){\n"+
    "  return createStripeCoreDispatcher({core,registry,sourceDispatch:originalDispatch})({name,args,connection,db,services});\n"+
    "}\n"+source.slice(end);
  return output.replace("import { Server }",imports+"import { Server }");
}
