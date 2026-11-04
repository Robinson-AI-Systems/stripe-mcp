// Original service-owned selected Stripe account, never an AI-supplied key.
// Verify account ID and provider mode independently before touching settings.
import {readVerifiedTestAccount,readVerifiedLiveAccount} from '../stripe/test-account.js';
const accountId=/^acct_[A-Za-z0-9]{2,100}$/;
export async function selectedAccountClient(ctx){
  const connection=ctx?.connection,mode=connection?.mode;
  if(!['test','live'].includes(mode)||!accountId.test(connection?.stripeAccount??'')||
    typeof ctx?.services?.stripeForConnection!=='function')
    throw new TypeError('Selected authenticated Stripe account required');
  if(mode==='live'){
    if(process.env.VERCEL_ENV!=='production'||typeof ctx?.db?.getStripeAccount!=='function')
      throw new TypeError('Independently activated LIVE account required');
    const a=await ctx.db.getStripeAccount(connection.stripeAccount);
    if(a?.id!==connection.stripeAccount||a.live_enabled!==true||
      a.live_connected!==true)
      throw new TypeError('Selected LIVE account disabled or disconnected');
  }
  const s=await ctx.services.stripeForConnection(connection);
  if(mode==='live')await readVerifiedLiveAccount(s,connection.stripeAccount);
  else await readVerifiedTestAccount(s,connection.stripeAccount);
  return s;
}
/** The one shared mode-aware provider client for the legacy families
 * (owner-obedience V2 shared seam; replaces the TEST-only helpers that
 * were duplicated in billing-shared.js, payment-writes.js and
 * checkout-writes.js). TEST resolution is exactly the historical
 * behavior: the connection's own service client, no extra provider
 * read, and the historical refusal when the service is unavailable.
 * LIVE resolution goes only through selectedAccountClient above:
 * production deployment, an independently enabled and connected
 * account, and a verified provider account/mode read before any
 * provider object is touched. Any other mode is refused. */
export async function modeClient(ctx){
  const mode=ctx?.connection?.mode;
  if(mode==='live')return selectedAccountClient(ctx);
  if(mode!=='test'||typeof ctx?.services?.stripeForConnection!=='function')
    throw new Error('TEST Stripe provider unavailable');
  return ctx.services.stripeForConnection(ctx.connection);
}
export function assertAccountResourceMode(v,mode,{required=false}={}){
  if(!['test','live'].includes(mode)||!v||typeof v!=='object'||
    (required||v.livemode!==undefined)&&
    (typeof v.livemode!=='boolean'||v.livemode!==(mode==='live')))
    throw new TypeError('Stripe provider resource mode mismatch');
  return v;
}
