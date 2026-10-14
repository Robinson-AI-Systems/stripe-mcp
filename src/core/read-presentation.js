// Canonical service-owned compatibility for public generic read presentation.
// Both the original MCP dispatch and private portable-core adapter must pass
// strict native handlers ONLY their own business arguments, while leaving
// the caller's safe display choices to the outer redacted result projector.
import {projectFields} from '../tools/result-rules.js';
export function nativeReadArgs(tool,args){
  if(tool?.writes!==false)return args;
  const properties=tool.inputSchema?.properties??{};
  let native=args;
  if(Object.hasOwn(args,'detail')&&!Object.hasOwn(properties,'detail')){
    if(!['summary','full'].includes(args.detail))
      throw new TypeError('Invalid read-only detail option');
    native={...native};delete native.detail;
  }
  if(Object.hasOwn(args,'fields')&&!Object.hasOwn(properties,'fields')){
    projectFields({},args.fields); // validates paths, duplicates and prototype keys
    native={...native};delete native.fields;
  }
  return native===args?args:Object.freeze(native);
}
