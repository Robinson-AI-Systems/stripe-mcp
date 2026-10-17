import {createKeyStore} from '../keys.js';
import {makeStripeClient} from './client.js';
// Authentication is derived exclusively from the verified OAuth connection.
export function createStripeForConnection({db,keyStoreFactory=createKeyStore,clientFactory=makeStripeClient}){
  return async connection=>{
    if(!['test','live'].includes(connection?.mode)||
      !/^acct_[A-Za-z0-9]{2,100}$/.test(connection?.stripeAccount||''))
      throw new Error('An authenticated selected Stripe account is required');
    if(connection.mode==='live') {
      if(process.env.VERCEL_ENV!=='production')
        throw new Error('Only a verified TEST account is available outside production; LIVE provider calls require production');
      const selected=await db.getStripeAccount(connection.stripeAccount);
      if(!selected?.live_enabled||!selected?.live_connected)
        throw new Error('Account LIVE access was not independently enabled');
    }
    const key=await keyStoreFactory({db}).loadKey({
      account:connection.stripeAccount,mode:connection.mode});
    return clientFactory({key,mode:connection.mode});
  };
}
