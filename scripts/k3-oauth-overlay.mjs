// Only the original service module is overlaid in verified private CI.
// Keep original owner login/registration behavior unchanged.
export function createOAuthProtocolOverlay(original){
  if(typeof original!=='string'||!original.startsWith('// Contract-generic OAuth HTTP handlers.')||
    !original.includes('export function createOAuthHandlers(')||
    !original.includes('async function authorize(')||
    !original.includes('async function token('))
    throw Error('Original Stripe OAuth source drift detected');
  return `// Temporary checksum-pinned private K-3 OAuth token adapter.
import * as core from 'robinson-mcp-core/oauth-protocol';
import * as source from './k3-oauth-original-private.js';
import {createStripeOAuthProtocolAdapter} from './k3-oauth-protocol-seams.js';
export function createOAuthHandlers({db,env=process.env}){
  return createStripeOAuthProtocolAdapter({core,source,db,env});
}
`;
}
