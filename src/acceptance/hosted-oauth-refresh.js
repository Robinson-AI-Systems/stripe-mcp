// One explicitly opted-in live-hosted, TEST-only OAuth refresh check.
// This rotates credentials and MUST be followed by owner revocation in the
// protected setup page. It never prints or persists the old or new tokens.
import {approvedOrigin,verifyDeployment} from './rtc-service-check.js';
import {verifyHostedStandaloneMcp,verifyHostedMcpRevocation}
  from './hosted-custom-mcp.js';

const TOKEN=/^[A-Za-z0-9_-]{43}$/;
const CLIENT=/^[A-Za-z0-9_-]{30,128}$/;
const ACCOUNT=/^acct_[A-Za-z0-9]{2,100}$/;
const MAX=4096;
function requireThat(condition,code){if(!condition)throw new Error(code);}
async function jsonReply(reply){
  requireThat(/^application\/json\b/i.test(reply.headers?.get?.('content-type')??''),
    'protected_ingress');
  const len=reply.headers?.get?.('content-length');
  requireThat(len==null||/^\d+$/.test(len)&&Number(len)<=MAX,'unexpected_reply');
  const text=await reply.text();
  requireThat(Buffer.byteLength(text,'utf8')<=MAX,'unexpected_reply');
  try{return JSON.parse(text);}catch{throw new Error('unexpected_reply');}
}
function failure(stage,error,rotated){
  const known=['origin_invalid','origin_not_pinned','deployment_unverified',
    'deployment_mismatch','credential_invalid','account_invalid',
    'protected_ingress','unexpected_reply','old_scope_unverified',
    'refresh_unverified','new_scope_unverified','old_token_still_active'];
  return {status:'failed',stage,code:known.includes(error?.message)?
    error.message:'remote_unavailable',refreshAttempted:rotated,
    requiresOwnerRevocation:rotated};
}
export async function verifyHostedOAuthRefresh({
  origin,approvedOrigin:pin,expectedDeploymentSha,
  clientId,accessToken,refreshToken,account,fetcher=fetch,
  verifyConnector=verifyHostedStandaloneMcp,
  verifyOldInvalid=verifyHostedMcpRevocation
}={}){
  let stage='setup',refreshAttempted=false;
  try{
    const base=approvedOrigin(origin,pin);
    requireThat(CLIENT.test(clientId)&&TOKEN.test(accessToken)&&
      TOKEN.test(refreshToken)&&accessToken!==refreshToken&&
      !accessToken.startsWith('rtc_pass_'),'credential_invalid');
    requireThat(ACCOUNT.test(account),'account_invalid');
    const common={origin:base,approvedOrigin:base,expectedDeploymentSha,
      account,fetcher};
    stage='deployment';
    const response=await fetcher(base+'/api/contract',{
      method:'GET',redirect:'manual',headers:{accept:'application/json'}});
    requireThat(response.status===200,'deployment_unverified');
    verifyDeployment(await jsonReply(response),expectedDeploymentSha);
    stage='old_connector';
    const first=await verifyConnector({...common,token:accessToken});
    requireThat(first?.status==='passed','old_scope_unverified');
    stage='token_refresh';
    // One and only one request: refresh credentials are single-use in the
    // original Stripe OAuth database. Never retry a network ambiguity.
    refreshAttempted=true;
    const reply=await fetcher(base+'/api/oauth/token',{
      method:'POST',redirect:'manual',headers:{
        accept:'application/json',
        'content-type':'application/x-www-form-urlencoded'
      },body:new URLSearchParams({
        grant_type:'refresh_token',client_id:clientId,
        refresh_token:refreshToken,resource:base+'/api/mcp'
      }).toString()});
    requireThat(reply.status===200,'refresh_unverified');
    const issued=await jsonReply(reply);
    requireThat(issued?.token_type==='Bearer'&&issued.expires_in===3600&&
      TOKEN.test(issued.access_token)&&TOKEN.test(issued.refresh_token)&&
      issued.access_token!==accessToken&&
      issued.refresh_token!==refreshToken&&
      issued.access_token!==issued.refresh_token,'refresh_unverified');
    stage='new_connector';
    const second=await verifyConnector({...common,token:issued.access_token});
    requireThat(second?.status==='passed','new_scope_unverified');
    stage='old_token_invalid';
    const old=await verifyOldInvalid({...common,revokedToken:accessToken});
    requireThat(old?.status==='passed','old_token_still_active');
    // Do not return the newly issued refresh token. Owner must revoke the
    // connection through their protected page even after this test passes.
    return {status:'passed',checks:['exact_live_deployment',
      'original_connector_scope','refresh_rotation',
      'refreshed_connector_same_scope','old_access_token_refused'],
      requiresOwnerRevocation:true,refreshAttempted:true,
      pkceLogin:'not_checked',providerRead:'not_checked',
      note:'Owner must revoke this TEST connector; rotated refresh token not exported'};
  }catch(error){return failure(stage,error,refreshAttempted);}
}
