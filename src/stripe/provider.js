import {createKeyStore} from '../keys.js';
import {makeStripeClient} from './client.js';
// Authentication is derived exclusively from the verified OAuth connection.
export function createStripeForConnection({db,keyStoreFactory=createKeyStore,clientFactory=makeStripeClient}){
  return async connection=>{
    if(connection?.mode!=='test'||!/^acct_[A-Za-z0-9]+$/.test(connection?.stripeAccount||''))
      throw new Error('A configured TEST Stripe connection is required');
    const key=await keyStoreFactory({db}).loadKey({
      account:connection.stripeAccount,mode:'test'});
    return clientFactory({key,mode:'test'});
  };
}
