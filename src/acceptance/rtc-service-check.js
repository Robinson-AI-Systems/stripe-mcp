// Opt-in genuine HTTPS RTC TEST acceptance. This runner does NOT simulate a
// deployment, store bearer credentials, or turn a successful CI test into proof.
import {isIP} from 'node:net';

const PASS=/^rtc_pass_[A-Za-z0-9_-]{43}$/;
const ACCOUNT=/^acct_[A-Za-z0-9]{2,100}$/;
const MAX_RESPONSE=64*1024;
function approvedOrigin(origin,pinned){
  if(typeof origin!=='string'||origin!==pinned)throw new Error('origin_not_pinned');
  let url;
  try{url=new URL(origin);}catch{throw new Error('origin_invalid');}
  if(url.protocol!=='https:'||url.origin!==origin||url.username||
    url.password||url.search||url.hash||url.pathname!=='/'||
    isIP(url.hostname)||url.hostname==='localhost'||
    /(?:^|\.)(?:local|internal|localhost)$/.test(url.hostname))
    throw new Error('origin_invalid');
  return origin;
}
function safeStatus(response){
  return Number.isInteger(response?.status)?response.status:0;
}
async function jsonReply(response){
  const length=Number(response.headers?.get?.('content-length'));
  if(Number.isFinite(length)&&length>MAX_RESPONSE)throw new Error('response_too_large');
  const contentType=response.headers?.get?.('content-type')??'';
  if(!/^application\/json\b/i.test(contentType))throw new Error('non_json_ingress');
  const raw=await response.text();
  if(Buffer.byteLength(raw,'utf8')>MAX_RESPONSE)throw new Error('response_too_large');
  try{return JSON.parse(raw);}catch{throw new Error('invalid_json');}
}
function demand(condition,reason){
  if(!condition)throw new Error(reason);
}
function reportFailure(stage,reason){
  // Never include a fetch error, response body, bearer, account label or provider
  // payload. Keep machine-readable failure stages for a safe owner handoff.
  const known=new Set(['origin_not_pinned','origin_invalid','credential_invalid',
    'account_invalid','http_unavailable','response_too_large','non_json_ingress',
    'invalid_json','manifest_mismatch','identity_mismatch','catalog_mismatch',
    'direct_read_failed','batch_failed','unsafe_tool_not_refused',
    'revocation_not_proved','provider_read_unverified',
    'deployment_unverified','deployment_mismatch']);
  return {status:'failed',stage,code:known.has(reason)?reason:'http_unavailable'};
}
function verifyDeployment(manifest,expectedDeploymentSha){
  if(typeof expectedDeploymentSha!=='string'||
    !/^[0-9a-f]{40}$/.test(expectedDeploymentSha))
    throw new Error('deployment_unverified');
  const deployed=manifest?.deployment;
  if(!deployed||!/^[0-9a-f]{40}$/.test(deployed.sha??'')||
    typeof deployed.ref!=='string'||!deployed.environment)
    throw new Error('deployment_unverified');
  if(deployed.sha!==expectedDeploymentSha||deployed.ref!=='live'||
    deployed.environment!=='production')
    throw new Error('deployment_mismatch');
}
export async function verifyRtcService({
  origin,approvedOrigin:pin,pass,expectedAccount,expectedDeploymentSha,
  fetcher=fetch,now=()=>Date.now(),providerRead=false
}){
  let stage='setup';
  try{
    const base=approvedOrigin(origin,pin);
    demand(PASS.test(pass),'credential_invalid');
    demand(ACCOUNT.test(expectedAccount),'account_invalid');
    const request=async(path,{method='GET',body,authenticated=true}={})=>{
      const reply=await fetcher(base+path,{
        method,redirect:'manual',headers:{
          ...(authenticated?{authorization:'Bearer '+pass}:{}),
          ...(body!==undefined?{'content-type':'application/json'}:{})},
        ...(body!==undefined?{body:JSON.stringify(body)}:{})
      });
      return {status:safeStatus(reply),data:await jsonReply(reply)};
    };
    stage='manifest';
    const manifest=await request('/api/contract',{authenticated:false});
    demand(manifest.status===200&&manifest.data.rtc===1&&
      manifest.data.prefix==='stripe'&&
      manifest.data.access==='test_read_only_only'&&
      JSON.stringify(manifest.data.profiles)===JSON.stringify(['read_only'])&&
      manifest.data.counts?.writes===0&&manifest.data.counts.money===0,
    'manifest_mismatch');
    verifyDeployment(manifest.data,expectedDeploymentSha);
    stage='identity';
    const who=await request('/api/whoami');
    const identity=who.data.result;
    demand(who.status===200&&who.data.ok===true&&
      identity?.account===expectedAccount&&identity.mode==='test'&&
      identity.profile==='read_only'&&identity.allowWrites===false&&
      identity.moneyLimitCents===0&&Number.isFinite(Date.parse(identity.expiresAt))&&
      Date.parse(identity.expiresAt)>now()&&
      Date.parse(identity.expiresAt)<=now()+3_660_000,
    'identity_mismatch');
    stage='catalog';
    const catalog=await request('/api/tools?listing=catalog&q=stripe_whoami&limit=10');
    demand(catalog.status===200&&catalog.data.ok===true&&
      Array.isArray(catalog.data.result?.tools)&&
      catalog.data.result.tools.some(t=>t.name==='stripe_whoami'&&
        t.writes===false&&t.money===false&&t.destructive===false&&
        JSON.stringify(t.profiles)===JSON.stringify(['read_only'])),
    'catalog_mismatch');
    stage='direct_read';
    const direct=await request('/api/tools/stripe_whoami',
      {method:'POST',body:{}});
    demand(direct.status===200&&direct.data.ok===true&&
      direct.data.result?.account===expectedAccount&&
      direct.data.result?.mode==='test',
    'direct_read_failed');
    stage='batch';
    const batch=await request('/api/tools/_batch',{method:'POST',
      body:{calls:[{name:'stripe_whoami',args:{}}]}});
    demand(batch.status===200&&batch.data.ok===true&&
      batch.data.result?.count===1&&
      batch.data.result?.results?.[0]?.result?.account===expectedAccount,
    'batch_failed');
    stage='write_refusal';
    // A forbidden tool must be rejected by the guard BEFORE invoking Stripe.
    const refused=await request('/api/tools/stripe_payment_cancel',
      {method:'POST',body:{}});
    demand(refused.status===403&&refused.data?.ok===false&&
      refused.data.error?.code==='refused_by_guard',
    'unsafe_tool_not_refused');
    const checks=['manifest','identity','catalog','direct_read','batch','write_refusal'];
    if(providerRead){
      stage='provider_read';
      demand(Array.isArray(identity.areas)&&identity.areas.includes('account'),
        'provider_read_unverified');
      // Account profile read is a genuine Stripe API call, unlike stripe_whoami
      // (which reads only this service's own stored account configuration).
      // A permission-denied account_get response may legitimately echo
      // only the selected local account ID with available:false. Therefore
      // identity alone is NEVER proof of a successful Stripe API read.
      // Require three safe booleans observed from the verified TEST provider.
      const provider=await request('/api/tools/stripe_account_get',
        {method:'POST',body:{fields:['id','chargesEnabled',
          'payoutsEnabled','detailsSubmitted']}});
      const snapshot=provider.data?.result;
      demand(provider.status===200&&provider.data.ok===true&&
        snapshot?.id===expectedAccount&&snapshot.available!==false&&
        typeof snapshot.chargesEnabled==='boolean'&&
        typeof snapshot.payoutsEnabled==='boolean'&&
        typeof snapshot.detailsSubmitted==='boolean',
      'provider_read_unverified');
      checks.push('provider_read');
    }
    return {status:'passed',checks,providerRead:providerRead?'passed':'not_run',
      note:'Direct authenticated TEST HTTPS only; not OAuth, webhook or Hub D-4'};
  }catch(error){
    return {...reportFailure(stage,error?.message),providerRead:providerRead?'failed':'not_run'};
  }
}
export async function verifyRtcRevocation({
  origin,approvedOrigin:pin,revokedPass,expectedDeploymentSha,fetcher=fetch
}){
  let stage='revocation';
  try{
    const base=approvedOrigin(origin,pin);
    demand(PASS.test(revokedPass),'credential_invalid');
    verifyDeployment(await (async()=>{
      const manifestResponse=await fetcher(base+'/api/contract',
        {method:'GET',redirect:'manual',headers:{}});
      demand(manifestResponse.status===200,'deployment_unverified');
      return jsonReply(manifestResponse);
    })(),expectedDeploymentSha);
    const result=await fetcher(base+'/api/whoami',{method:'GET',redirect:'manual',
      headers:{authorization:'Bearer '+revokedPass}});
    const data=await jsonReply(result);
    demand(result.status===401&&data.ok===false&&
      data.error?.code==='pass_revoked','revocation_not_proved');
    return {status:'passed',checks:['revocation'],note:'Direct TEST HTTPS only'};
  }catch(error){return reportFailure(stage,error?.message);}
}
