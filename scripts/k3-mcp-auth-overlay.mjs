// Strict original Stripe source-to-private-bearer module shim in throwaway CI.
export function createMcpAuthOverlay(original){
  if(typeof original!=='string'||original.length>30000||
    !original.startsWith('// Contract-generic MCP bearer authentication.')||
    !original.includes('export async function requireMcpToken(')||
    !original.includes('db.getAccessToken('))
    throw new Error('Original Stripe durable MCP bearer boundary changed');
  return `// K-3 PRIVATE CORE ONLY. CI restores original service file in finally.
import * as core from 'robinson-mcp-core/mcp-auth';
import {createStripeCoreMcpAuthenticator} from './k3-mcp-auth-seams.js';
export async function requireMcpToken(req,res,db,env=process.env){
  return createStripeCoreMcpAuthenticator({core,db,env})(req,res);
}
`;
}
