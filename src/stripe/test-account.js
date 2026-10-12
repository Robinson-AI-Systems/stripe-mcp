// A Stripe Account object does not publish livemode. Verify the authenticated
// account ID first, then prove TEST mode from a separate provider balance read.
// Never infer TEST from a missing field or from an AI/HTTP mode argument.
const validId=x=>typeof x==='string'&&/^acct_[A-Za-z0-9]{2,100}$/.test(x);

export async function readVerifiedTestAccount(stripe,expected) {
  const account=await stripe.accounts.retrieve();
  const id=expected===undefined?account?.id:expected;
  if(!validId(id)||account?.object!=='account'||account.id!==id)
    throw new TypeError('Exact Stripe account identity unavailable');
  if(account.livemode===false)return account;
  // Explicit false remains required; a present but unsafe provider mode
  // cannot be overridden by an unrelated successful balance response.
  if(account.livemode!==undefined)
    throw new TypeError('Non-TEST or malformed account mode refused');
  // GET /v1/balance uses the same authenticated Stripe client and has an
  // explicit livemode boolean. A denied/unavailable response fails closed.
  const balance=await stripe.balance.retrieve();
  if(balance?.object!=='balance'||balance.livemode!==false)
    throw new TypeError('Independent Stripe TEST-mode evidence unavailable');
  return {...account,livemode:false};
}
