// Selected owner LIVE customer operations re-use the source service's
// account credential selection and independent account/balance verification.
import {selectedAccountClient} from './account-mode.js';
export const selectedCustomerMode=ctx=>['test','live'].includes(ctx?.connection?.mode);
export async function customerClient(ctx){
  if(!selectedCustomerMode(ctx)||typeof ctx?.services?.stripeForConnection!=='function')
    throw new TypeError('Verified Stripe customer account unavailable');
  if(ctx.connection.mode==='live')return selectedAccountClient(ctx);
  return ctx.services.stripeForConnection(ctx.connection);
}
// Stripe customer, tax ID and payment method objects carry livemode.
// Historical TEST-only synthetic fixtures may omit it, but wrong-mode
// evidence is always refused; LIVE must affirmatively prove true.
export function verifiedCustomerResource(v,ctx,{tombstone=false}={}){
  if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError('Provider resource unavailable');
  const mode=ctx?.connection?.mode;
  if(!['test','live'].includes(mode)||
    (!tombstone&&mode==='live'&&v.livemode!==true)||
    v.livemode!==undefined&&v.livemode!==(mode==='live'))
    throw new TypeError('Customer provider resource does not match authenticated mode');
  return v;
}
