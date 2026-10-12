// CI-only portable K-3 boundary. Stripe retains all production SDK/SQL/guards.
import {isToolAllowed,isGuardedTestWrite} from './profiles.js';
import {shapeToolResult} from '../tools/util.js';
import {toStripeToolError} from '../tools/errors.js';
import {readDetail,splitResult,resultPage} from '../tools/result-rules.js';
const value=(node,key)=>Object.getOwnPropertyDescriptor(node,key)?.value;
export function createStripeCoreDispatcher({core,registry}){
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
      handlers[name]=own.value;
  }
  const service=core.createGuardedMcpDispatcher({
    registry:{tools,handlers},
    authorizeTool:(tool,connection)=>
      connection?.mode==='test'&&typeof connection.stripeAccount==='string'&&
      !!connection.stripeAccount&&
      isToolAllowed(tool,connection.profile,{
        allowWrites:isGuardedTestWrite(tool,connection)}),
    shapeResult:shapeToolResult,readDetail,splitResult,resultPage,
    formatError:toStripeToolError,
    skipDetailFor:name=>name==='stripe_get_result'
  });
  return service.dispatch;
}
