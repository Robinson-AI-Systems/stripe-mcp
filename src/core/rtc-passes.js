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


// RTC 1 owner-configured passes. This issuer is invoked ONLY after the server's
// private owner setup passphrase+CSRF gate; it never trusts a tool-supplied
// "authenticated" boolean. The existing read-only issuer remains unchanged
// for short-lived TEST Hub acceptance fixtures.
const PROFILES=new Set(['read_only','everyday','full']);
function passAreas(areas,available){
  const items=typeof areas==='string'?areas.split(',').map(x=>x.trim()):areas;
  if(!Array.isArray(items)||items.length<1||items.length>6||
    items.some(x=>typeof x!=='string'||!/^[a-z][a-z_]{0,49}$/.test(x)||
      !available.has(x))||new Set(items).size!==items.length)
    throw new TypeError('Choose 1–6 distinct allowed service areas');
  return items;
}
export function createOwnerPassIssuer({db,oneTimeStore,availableAreas=['server'],
  verifyOwner,now=()=>Date.now()}){
  if(typeof db?.createRtcPass!=='function'||typeof db.getStripeAccount!=='function'||
    typeof oneTimeStore?.issue!=='function'||typeof verifyOwner!=='function')
    throw new TypeError('Protected owner pass dependencies unavailable');
  const available=new Set(availableAreas);
  return async function issueOwnerPass({account,mode='test',profile='read_only',
    areas='server',allowWrites=false,moneyLimitCents=0,rateLimitPerMinute=120,
    hours=24,forHub=false,confirm=false,liveConfirm=false,liveWriteConfirm=false,
    liveMoneyConfirm=false}={}){
    // A submitted form value is never proof of the owner's identity.
    if(await verifyOwner({account})!==true||confirm!==true)
      throw new TypeError('Authenticated independent owner confirmation required');
    if(typeof account!=='string'||!/^acct_[A-Za-z0-9]{2,100}$/.test(account)||
      !PROFILES.has(profile)||typeof allowWrites!=='boolean'||
      typeof forHub!=='boolean'||!Number.isInteger(hours)||hours<1||
      hours>(forHub?365:30)*24||
      !Number.isInteger(rateLimitPerMinute)||rateLimitPerMinute<1||
      rateLimitPerMinute>600||
      !Number.isSafeInteger(moneyLimitCents)||moneyLimitCents<0||
      (allowWrites&&profile==='read_only')||
      (moneyLimitCents>0&&!allowWrites))
      throw new TypeError('Invalid owner-selected RTC scope/expiry/rate/financial policy');
    // The account is enabled separately by B-8's owner passphrase step; this
    // pass gets its own fresh password gate and mode-specific express consent.
    // LIVE money delegation requires its own owner checkbox and never removes
    // the separately password-authenticated per-request money approval gate.
    if(!['test','live'].includes(mode)||
      (mode==='live'&&(liveConfirm!==true||
        (allowWrites&&liveWriteConfirm!==true)||
        (moneyLimitCents>0&&liveMoneyConfirm!==true))))
      throw new TypeError('Separate owner LIVE consent and existing LIVE money safeguards required');
    const selectedAreas=passAreas(areas,available);
    const selected=await db.getStripeAccount(account);
    if(mode==='test'&&!selected?.test_connected||
      mode==='live'&&(!selected?.live_enabled||!selected?.live_connected))
      throw new TypeError('Selected account is not independently enrolled and activated for this mode');
    const id='rtc-agent-'+randomBytes(12).toString('hex');
    const token='rtc_pass_'+randomBytes(32).toString('base64url');
    if(!RTC_PASS_PATTERN.test(token))
      throw new TypeError('Cryptographic RTC pass generation failed');
    const expiresAt=new Date(now()+hours*3_600_000);
    const grant={id,account,token,mode,profile,areas:selectedAreas,
      allowWrites,moneyLimitCents,forHub,rateLimitPerMinute,expiresAt};
    if(await db.createRtcPass(grant)!==true)
      throw new TypeError('Selected account cannot issue that RTC pass');
    let issued;
    try{
      issued=await oneTimeStore.issue({account,mode,kind:'rtc-pass',secret:token});
      if(!new RegExp('^/api/stripe/setup[?]show=[A-Za-z0-9_-]{32}$').test(issued?.setupPath))
        throw new TypeError('Private one-time reveal path unavailable');
    }catch(error){
      // No unusable bearer survives a failed private one-time handoff.
      await db.revokeAccessToken(token).catch(()=>{});
      throw error;
    }
    return {id,account,mode,profile,areas:selectedAreas,
      allowWrites,moneyLimitCents,forHub,rateLimitPerMinute,expiresAt,
      lifetimeHours:hours,setupPath:issued.setupPath,
      notice:moneyLimitCents>0?'This is a delegated ceiling, not an independent money-out approval.':
        'No delegated money-out ceiling; any financial execution remains independently guarded.'};
  };
}
