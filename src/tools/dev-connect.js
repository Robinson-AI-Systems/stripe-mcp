// TEST Connect availability probe; does not create accounts or move money.
import {guarded,allProfiles} from './billing-shared.js';
import {gone} from './write.js';
import {verifyConnectReadiness} from '../dev/marketplace.js';
export const tools=[{name:'dev_connect_readiness',area:'developer',
  writes:false,profiles:allProfiles,
  description:'Verify TEST Connect account API access and report capability state; no transfers or payouts.',
  annotations:{readOnlyHint:true},
  inputSchema:{type:'object',properties:{},additionalProperties:false}
}];
export const handlers={
  dev_connect_readiness:(a,ctx)=>{
    if(ctx?.connection?.mode!=='test')
      return gone('Connect developer readiness is TEST only');
    if(!a||typeof a!=='object'||Array.isArray(a)||
      Object.keys(a).length!==0)
      return gone('This TEST Connect readiness check accepts no arguments');
    return guarded(ctx,s=>verifyConnectReadiness(
      s,ctx.connection.stripeAccount));
  }
};
