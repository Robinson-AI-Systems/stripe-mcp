// Private K-3 profiles compatibility overlay, only in isolated Stripe CI.
// Original service-specific safety/selection functions remain source-owned.
export const coreProfileExports=Object.freeze([
  'CONNECTION_PROFILES','isToolAllowed','visibleTools',
  'profileCounts','publicToolInfo'
]);
export function createProfileOverlay(source){
  if(typeof source!=='string'||source.length>30000)
    throw new Error('Unsafe source profiles input');
  const start=source.indexOf('const guardedTestAreas=');
  const end=source.indexOf('export function publicToolInfo(');
  if(start<0||end<=start||source.indexOf('const guardedTestAreas=',start+1)>=0||
    source.indexOf('export function publicToolInfo(',end+1)>=0)
    throw new Error('Original Stripe source profile seam changed');
  const owned=source.slice(start,end);
  for(const required of ['export function isGuardedTestWrite(',
    'export function listingForConnection(','const compactNames=']) {
    if(!owned.includes(required))throw new Error('Missing Stripe-owned listing policy');
  }
  // Re-export only the exact generic core functions; selected TEST areas,
  // write gating, listing mode and delegated/metatool behavior remain Stripe's.
  const imports="import {isToolAllowed,visibleTools} from 'robinson-mcp-core/profiles';\n";
  const exports="export {"+coreProfileExports.join(',')+"} from 'robinson-mcp-core/profiles';\n";
  return '// K-3 temporary private-package profile source compatibility test.\n'+
    imports+exports+owned;
}
