// Owner-only TEST selection and encrypted-key access. The caller must first
// authenticate administrator passphrase, CSRF and canonical Origin.
import {runOwnerTestSmoke} from './owner-test-smoke.js';
import {OwnerSmokeFailure} from './owner-smoke-failure.js';

export function createOwnerSmokeRunner({db,keyStore,run=runOwnerTestSmoke}) {
  if(typeof db?.getStripeAccount!=='function'||
    typeof keyStore?.loadKey!=='function'||typeof run!=='function')
    throw new TypeError('Owner TEST dependencies missing');
  return async ({account,focus})=>{
    if(typeof account!=='string'||!/^acct_[A-Za-z0-9]{2,100}$/.test(account))
      throw new OwnerSmokeFailure('not_enrolled');
    let record;
    try{record=await db.getStripeAccount(account);}
    catch{throw new OwnerSmokeFailure('unavailable');}
    if(!record?.test_connected)throw new OwnerSmokeFailure('not_enrolled');
    let key;
    try{key=await keyStore.loadKey({account,mode:'test'});}
    catch{throw new OwnerSmokeFailure('key_unavailable');}
    try { return await run({account,key,focus}); }
    catch(error){
      if(error instanceof OwnerSmokeFailure)throw error;
      throw new OwnerSmokeFailure('unavailable');
    }
  };
}
