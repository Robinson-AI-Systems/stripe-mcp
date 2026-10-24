// Public, read-only CAP-2 permission explanation on an authenticated MCP connection.
// Provider keys/tokens are never opened, returned or accepted as arguments.
import { explainEffectiveAccess } from '../core/effective-access.js';

const profiles=['read_only','everyday','full'];
const okay=value=>({content:[{type:'text',text:JSON.stringify(value)}]});
const deny=message=>({isError:true,content:[{type:'text',text:message}]});
export const tools=[{
  name:'stripe_explain_access',
  description:'Explain current Stripe tool access, profile differences and safe permission recovery without changing grants.',
  area:'server',
  writes:false,
  profiles,
  detailFieldsSupported:false,
  annotations:{readOnlyHint:true},
  inputSchema:{
    type:'object',additionalProperties:false,
    properties:{
      tool:{type:'string',minLength:2,maxLength:81,pattern:'^[a-z][a-z0-9_]{1,80}$'},
      compareProfiles:{type:'boolean'}
    },required:['tool']
  }
}];
export const handlers={
  async stripe_explain_access(args,{registry,connection,db}){
    if(!args||typeof args!=='object'||Array.isArray(args)||
       Object.keys(args).some(key=>!['tool','compareProfiles'].includes(key))||
       typeof args?.tool!=='string'||!/^[a-z][a-z0-9_]{1,80}$/.test(args.tool)||
       (args.compareProfiles!==undefined&&typeof args.compareProfiles!=='boolean')||
       !connection||typeof connection.stripeAccount!=='string'||
       typeof db?.getStripeAccount!=='function')
      return deny('Use a registered tool name with a verified connection.');
    const account=await db.getStripeAccount(connection.stripeAccount);
    const result=explainEffectiveAccess({registry,connection,account,
      toolName:args.tool,includeProfiles:args.compareProfiles===true});
    if(result.status==='denied')
      return deny('The selected account and connection could not be verified.');
    return okay(result);
  }
};
