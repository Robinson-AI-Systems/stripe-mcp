// Conservative TEST-only deletion of Connect sellers and time-travel clocks.
// No transfer, payout, refund, reversal or customer data search by name.
const exactMissing=e=>e?.statusCode===404&&
  (e?.code==='resource_missing'||e?.raw?.code==='resource_missing');
export async function gone(read,id){
  try{
    const after=await read();
    return after?.id===id&&after.deleted===true;
  }catch(error){return exactMissing(error);}
}
const zeroBalances=x=>x?.object==='balance'&&
  Array.isArray(x.available)&&Array.isArray(x.pending)&&
  [...x.available,...x.pending,
    ...(Array.isArray(x.connect_reserved)?x.connect_reserved:[]),
    ...(Array.isArray(x.instant_available)?x.instant_available:[])
  ].every(v=>Number.isSafeInteger(v?.amount)&&v.amount===0&&
    typeof v.currency==='string'&&v.currency.length===3);
export async function cleanupTestConnectSeller(s,account,opts){
  // Only an unused, incompletely onboarded TEST seller can be deleted.
  // Even a zero-balance active seller might carry future liabilities.
  if(account?.object!=='account'||account.livemode!==false||
    account.type!=='express'||account.country!=='US'||
    account.charges_enabled!==false||account.payouts_enabled!==false||
    account.details_submitted!==false||
    !['inactive','pending'].includes(account.capabilities?.transfers)||
    typeof s.balance?.retrieve!=='function')return false;
  const balance=await s.balance.retrieve({},{stripeAccount:account.id});
  if(!zeroBalances(balance))return false;
  const acknowledgment=await s.accounts.del(account.id,{},opts);
  if(acknowledgment?.object!=='account'||acknowledgment.id!==account.id||
    acknowledgment.deleted!==true)return false;
  return gone(()=>s.accounts.retrieve(account.id),account.id);
}
export async function cleanupTestClock(s,clock,ctx,runId,opts){
  if(clock?.object!=='test_helpers.test_clock'||clock.livemode!==false||
    clock.status!=='ready'||typeof s.customers?.list!=='function'||
    typeof s.testHelpers?.testClocks?.del!=='function')
    return false;
  // Before deleting a clock, every tracked dependent customer/subscription
  // must already have independent verified cleanup recorded in the DB.
  const rows=await ctx.db.getDevRunObjects({
    account:ctx.connection.stripeAccount,id:runId});
  if(!Array.isArray(rows)||rows.some(r=>
    ['customer','subscription'].includes(r.object_type)&&r.cleaned!==true))
    return false;
  // Also inspect actual Stripe customer references. Untracked references
  // forbid deleting the clock even when our run ledger is complete.
  const customers=await s.customers.list({test_clock:clock.id,limit:1});
  if(customers?.object!=='list'||!Array.isArray(customers.data)||
    customers.data.length!==0||customers.has_more!==false)
    return false;
  const ack=await s.testHelpers.testClocks.del(clock.id,{},opts);
  if(ack?.object!=='test_helpers.test_clock'||ack.id!==clock.id||
    ack.deleted!==true)return false;
  return gone(()=>s.testHelpers.testClocks.retrieve(clock.id),clock.id);
}
