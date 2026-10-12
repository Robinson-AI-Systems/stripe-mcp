// Disposable original-service source overlay. Restored unconditionally in CI.
export function createPrivateStripeWriteOverlay(source){
  if(typeof source!=='string'||!source.startsWith('// Reusable, provider-agnostic write lifecycle.')||
    !source.includes('export function defineWrite(')||
    !source.includes("'rmcp_'")||
    !source.includes('afterApply'))
    throw Error('Stripe source guarded write contract drifted');
  return `// PRIVATE CI-only K-3 source write adapter; no production dependency.
import * as core from 'robinson-mcp-core/write';
import {createStripeCoreWriteAdapter} from './k3-write-seams.js';
export const {defineWrite}=createStripeCoreWriteAdapter({core});
`;
}
