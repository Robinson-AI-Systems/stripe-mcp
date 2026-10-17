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
export function assertAccountResourceMode(v,mode,{required=false}={}){
  if(!['test','live'].includes(mode)||!v||typeof v!=='object'||
    (required||v.livemode!==undefined)&&
    (typeof v.livemode!=='boolean'||v.livemode!==(mode==='live')))
    throw new TypeError('Stripe provider resource mode mismatch');
  return v;
}
