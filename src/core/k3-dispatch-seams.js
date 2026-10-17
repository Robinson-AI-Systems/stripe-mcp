// CI-only portable K-3 boundary. Stripe retains all production SDK/SQL/guards.
import {isToolAllowed,isGuardedTestWrite,isGuardedLiveWrite} from './profiles.js';
import {shapeToolResult} from '../tools/util.js';
import {toStripeToolError} from '../tools/errors.js';
import {readDetail,splitResult,resultPage} from '../tools/result-rules.js';
import {nativeReadArgs} from './read-presentation.js';
const value=(node,key)=>Object.getOwnPropertyDescriptor(node,key)?.value;
export function createStripeCoreDispatcher({core,registry,sourceDispatch}){
  if(typeof core?.createGuardedMcpDispatcher!=='function'||
    !Array.isArray(registry?.tools)||!registry.handlers)
    throw new TypeError('Reviewed private core and source registry required');
  const tools=[],handlers=Object.create(null);
  for(const entry of registry.tools){
    if(!entry||typeof entry!=='object')continue;
    const name=value(entry,'name'),profiles=value(entry,'profiles');
    const writes=value(entry,'writes');
    if(typeof name!=='string'||!/^[a-z][a-z0-9_]{1,80}$/.test(name)||
      typeof writes!=='boolean'||!Array.isArray(profiles)||
      profiles.some(p=>!['read_only','everyday','full'].includes(p)))continue;
    const tool={name,writes,profiles:[...profiles]};
    const area=value(entry,'area'),contract=value(entry,'writeContract');
    if(typeof area==='string')tool.area=area;
    if(typeof contract==='string')tool.writeContract=contract;
    tools.push(tool);
    const own=Object.getOwnPropertyDescriptor(registry.handlers,name);
    if(own&&Object.hasOwn(own,'value')&&typeof own.value==='function')
      handlers[name]=writes===false?
        (args,ctx)=>own.value(nativeReadArgs(entry,args),ctx):own.value;
  }
  const service=core.createGuardedMcpDispatcher({
    registry:{tools,handlers},
    authorizeTool:(tool,connection)=>{
      // Use complete source descriptor for financial and mode-specific guards.
      const original=registry.tools.find(t=>t.name===tool?.name);
      const canWrite=original&&(isGuardedTestWrite(original,connection)||
        isGuardedLiveWrite(original,connection));
      return ['test','live'].includes(connection?.mode)&&
        typeof connection.stripeAccount==='string'&&
        !!connection.stripeAccount&&
        isToolAllowed(original,connection.profile,{allowWrites:canWrite===true});
    },
    shapeResult:shapeToolResult,readDetail,splitResult,resultPage,
    formatError:toStripeToolError,
    skipDetailFor:name=>name==='stripe_get_result'
  });
  return request=>{
    // The portable dispatcher is read-only under nested runRead. Stripe's
    // service-specific guarded stripe_call + batch contracts remain under
    // the original hardened source dispatcher until independent parity.
    if(['stripe_call','stripe_batch'].includes(request.name)){
      if(typeof sourceDispatch!=='function')
        throw new TypeError('Original guarded meta dispatch required');
      return sourceDispatch(request);
    }
    return service.dispatch(request);
  };
}
