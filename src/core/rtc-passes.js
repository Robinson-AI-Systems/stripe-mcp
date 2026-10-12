// Owner-only issue path for a short-lived RTC pass. No raw token in API/MCP results.
// "read_only" and TEST are fixed: widening scope requires a separate reviewed card.
import {randomBytes} from 'node:crypto';
export const RTC_PASS_PATTERN=/^rtc_pass_[A-Za-z0-9_-]{43}$/;
export function createReadOnlyTestPassIssuer({db,oneTimeStore,
  availableAreas=['server'],now=()=>Date.now()}){
  if(typeof db?.createRtcReadOnlyPass!=='function'||!oneTimeStore?.issue)
    throw new TypeError('Private pass issuance unavailable');
  const allowed=new Set(availableAreas);
  return async({account,areas='server',hours=24})=>{
    if(hours!==1&&hours!==24)throw new TypeError('Choose 1 or 24 hours');
    // The owner explicitly selects up to six verified read areas. Neither
    // bearer arguments nor a connector may enlarge this persisted grant.
    if(typeof areas!=='string'||areas.length>120)
      throw new TypeError('Choose read-only areas');
    const selectedAreas=areas.split(',').map(a=>a.trim());
    if(selectedAreas.length<1||selectedAreas.length>6||
      selectedAreas.some(a=>!/^[-a-z_]{1,50}$/.test(a)||!allowed.has(a))||
      new Set(selectedAreas).size!==selectedAreas.length)
      throw new TypeError('Choose distinct supported read-only areas');
    if(typeof account!=='string'||!/^acct_[A-Za-z0-9]{2,100}$/.test(account))
      throw new TypeError('Exact TEST Stripe account required');
    const selected=await db.getStripeAccount(account);
    if(!selected?.test_connected||selected.live_enabled===true)
      throw new TypeError('Connected TEST account required without LIVE activation');
    const id='rtc-agent-'+randomBytes(12).toString('hex');
    const token='rtc_pass_'+randomBytes(32).toString('base64url');
    if(!RTC_PASS_PATTERN.test(token))throw new TypeError('Pass generator failed');
    const expiresAt=new Date(now()+hours*60*60*1000);
    if(await db.createRtcReadOnlyPass({id,account,token,expiresAt,areas:selectedAreas})!==true)
      throw new Error('Pass persistence failed');
    const issued=await oneTimeStore.issue({account,mode:'test',kind:'rtc-read-only-pass',secret:token});
    if(!/^\/api\/stripe\/setup\?show=[A-Za-z0-9_-]{32}$/.test(issued.setupPath))
      throw new Error('One-time handoff unavailable');
    return {id,account,expiresAt,setupPath:issued.setupPath,mode:'test',
      profile:'read_only',allowWrites:false,moneyLimitCents:0,
      lifetimeHours:hours,areas:selectedAreas};
  };
}
